from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
import datetime
from functools import wraps
import pandas as pd
import os
import shutil
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_super_secret_key_123')
UPLOAD_FOLDER = os.path.join(app.instance_path, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='User')
    job_role = db.Column(db.String(50), nullable=True)
    job_location = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(50), nullable=True)
    clearance_level = db.Column(db.Integer, nullable=False, default=1)

class Dataset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    assigned_location = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(50), nullable=True)
    clearance_level = db.Column(db.Integer, nullable=False, default=1)

ROLE_PERMISSIONS = {
    'Admin': ['can_view_data', 'can_upload_data', 'can_manage_users', 'can_delete_data'],
    'Manager': ['can_view_data', 'can_upload_data'],
    'Data Engineer': ['can_view_data', 'can_upload_data'],
    'Auditor': ['can_view_data', 'can_assess_risk', 'can_test_controls', 'can_gather_evidence', 'can_verify_accuracy', 'can_ensure_compliance', 'can_issue_opinion', 'can_report_findings'],
    'User': ['can_view_data']
}

def get_user_permissions(role):
    return ROLE_PERMISSIONS.get(role, ['can_view_data'])

# Decorator for JWT authentication
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            token = token.split(" ")[1] # Bearer token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data['id']).first()
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

def permission_required(permission):
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            perms = get_user_permissions(current_user.role)
            if permission not in perms:
                return jsonify({'message': f'Permission {permission} required!'}), 403
            return f(current_user, *args, **kwargs)
        return decorated_function
    return decorator

# Setup Database
with app.app_context():
    db.create_all()
    if not User.query.filter_by(role='Admin').first():
        hashed_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
        admin = User(username='admin', password_hash=hashed_pw, role='Admin', department='IT', clearance_level=5)
        db.session.add(admin)
        db.session.commit()
    
    # Auto-load dataset if empty
    if not Dataset.query.first():
        csv_path = r'k:\saleproject\Sales Data.csv'
        if os.path.exists(csv_path):
            target_path = os.path.join(UPLOAD_FOLDER, 'sales_data.csv')
            shutil.copy(csv_path, target_path)
            ds = Dataset(name="Sales Dataset 2019", filename="sales_data.csv", assigned_location="Global", department="Global", clearance_level=1)
            db.session.add(ds)
            db.session.commit()
            print("Successfully auto-loaded the generic dataset!")

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400
    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, password_hash=hashed_pw, role='User')
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and bcrypt.check_password_hash(user.password_hash, data.get('password')):
        perms = get_user_permissions(user.role)
        token = jwt.encode({'id': user.id, 'role': user.role, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({
            'token': token, 
            'role': user.role, 
            'username': user.username,
            'permissions': perms,
            'department': user.department,
            'clearance_level': user.clearance_level
        })
    return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/api/users', methods=['GET'])
@token_required
@permission_required('can_manage_users')
def get_users(current_user):
    users = User.query.all()
    user_list = [{'id': u.id, 'username': u.username, 'role': u.role, 'job_role': u.job_role, 'job_location': u.job_location, 'department': u.department, 'clearance_level': u.clearance_level} for u in users]
    return jsonify(user_list)

@app.route('/api/users', methods=['POST'])
@token_required
@permission_required('can_manage_users')
def create_user(current_user):
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'User')
    job_role = data.get('job_role', 'Analyst')
    job_location = data.get('job_location', 'Global')
    department = data.get('department', 'Global')
    clearance_level = int(data.get('clearance_level', 1))
    
    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400
        
    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, password_hash=hashed_pw, role=role, job_role=job_role, job_location=job_location, department=department, clearance_level=clearance_level)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User created successfully'})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@permission_required('can_manage_users')
def delete_user(current_user, user_id):
    if user_id == current_user.id:
        return jsonify({'message': 'Cannot delete yourself'}), 400
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'})

@app.route('/api/datasets', methods=['GET'])
@token_required
@permission_required('can_view_data')
def get_datasets(current_user):
    datasets = Dataset.query.all()
    if 'can_manage_users' in get_user_permissions(current_user.role):
        filtered_ds = datasets
    else:
        filtered_ds = [d for d in datasets if 
            (d.assigned_location == 'Global' or d.assigned_location == current_user.job_location) and 
            (d.department == 'Global' or d.department == current_user.department) and 
            d.clearance_level <= current_user.clearance_level
        ]
    return jsonify([{'id': d.id, 'name': d.name, 'assigned_location': d.assigned_location, 'department': d.department, 'clearance_level': d.clearance_level} for d in filtered_ds])

@app.route('/api/upload', methods=['POST'])
@token_required
@permission_required('can_upload_data')
def upload_data(current_user):
    if 'file' not in request.files:
        return jsonify({'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
        
    try:
        filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        assigned_location = request.form.get('assigned_location', 'Global')
        department = request.form.get('department', 'Global')
        clearance_level = int(request.form.get('clearance_level', 1))
        
        # Verify it's readable
        df = pd.read_csv(filepath, nrows=5)
        
        ds = Dataset(name=file.filename, filename=filename, assigned_location=assigned_location, department=department, clearance_level=clearance_level)
        db.session.add(ds)
        db.session.commit()
        return jsonify({'message': 'Dataset uploaded successfully'})
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/datasets/<int:dataset_id>', methods=['DELETE'])
@token_required
@permission_required('can_delete_data')
def delete_dataset(current_user, dataset_id):
    ds = Dataset.query.get(dataset_id)
    if not ds:
        return jsonify({'message': 'Dataset not found'}), 404
        
    try:
        # Remove file from disk
        filepath = os.path.join(UPLOAD_FOLDER, ds.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            
        # Remove from DB
        db.session.delete(ds)
        db.session.commit()
        return jsonify({'message': 'Dataset deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@app.route('/api/insights/<int:dataset_id>', methods=['GET'])
@token_required
def get_insights(current_user, dataset_id):
    ds = Dataset.query.get(dataset_id)
    if not ds:
        return jsonify({'message': 'Dataset not found'}), 404
        
    filepath = os.path.join(UPLOAD_FOLDER, ds.filename)
    if not os.path.exists(filepath):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        # Load dataset
        df = pd.read_csv(filepath)
        df = df.dropna(how='all')
        
        # Apply filters from query params
        for col, val in request.args.items():
            if col in df.columns and val:
                # Need to match types properly. We assume string matching for simplicity here.
                df = df[df[col].astype(str) == val]
        
        if df.empty:
            return jsonify({
                'kpis': [{'title': 'No Data', 'value': 0}],
                'bar_chart': None,
                'line_chart': None
            })
        
        # Auto-detect columns
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        # Refine column types: treat low-cardinality numerics as categorical
        true_numeric = []
        for col in numeric_cols:
            if df[col].nunique() <= 10 or 'gender' in col.lower() or 'stress' in col.lower():
                categorical_cols.append(col)
            else:
                true_numeric.append(col)
        numeric_cols = true_numeric
        
        # 1. KPIs
        kpis = []
        
        # Add KPI for continuous numeric columns
        for col in numeric_cols:
            if len(kpis) >= 3: break # Leave room for categorical KPIs
            if 'id' not in col.lower() and 'zip' not in col.lower():
                # If it's a financial or count metric, sum it, otherwise average it.
                lower_col = col.lower()
                if any(x in lower_col for x in ['sale', 'revenue', 'cost', 'price', 'profit', 'amount']):
                    val = float(df[col].sum())
                    kpis.append({'title': f'Total {col}', 'value': val})
                else:
                    # Default to average for things like Age, Score, Rate, etc.
                    val = float(df[col].mean())
                    kpis.append({'title': f'Avg {col}', 'value': val})
                
        # Add KPI for categorical columns (most common value)
        for col in categorical_cols:
            if len(kpis) >= 5: break
            if 'id' not in col.lower():
                most_common = df[col].mode(dropna=True)
                if not most_common.empty:
                    val = most_common.iloc[0]
                    kpis.append({'title': f'Most Common {col}', 'value': str(val)})
                    
        # Fill remaining with more averages if needed
        if len(kpis) < 5 and len(numeric_cols) > 0:
            for col in numeric_cols:
                if len(kpis) >= 5: break
                if 'id' not in col.lower() and 'zip' not in col.lower():
                    # check if we already added this column
                    if not any(k['title'].endswith(col) for k in kpis):
                        col_avg = float(df[col].mean())
                        kpis.append({'title': f'Average {col}', 'value': col_avg})

        # 2. Bar Chart (Cat vs Num)
        bar_data = None
        if len(categorical_cols) > 0 and len(numeric_cols) > 0:
            cat_col = categorical_cols[0]
            num_col = numeric_cols[0]
            # Avoid using 'id' or purely unique identifiers for category if possible
            for c in categorical_cols:
                if df[c].nunique() < 50:
                    cat_col = c
                    break
            
            for n in numeric_cols:
                if 'id' not in n.lower():
                    num_col = n
                    break
                    
            grouped = df.groupby(cat_col)[num_col].sum().sort_values(ascending=False).head(10)
            bar_data = {
                'title': f'{num_col} by {cat_col}',
                'labels': grouped.index.tolist(),
                'values': grouped.values.tolist(),
                'cat_col': cat_col,
                'num_col': num_col
            }
            
        # 3. Line Chart (Another Cat/Time vs Num)
        line_data = None
        if len(categorical_cols) > 1 and len(numeric_cols) > 0:
            # try to find a date column
            date_col = None
            for c in categorical_cols:
                if 'date' in c.lower() or 'month' in c.lower() or 'year' in c.lower():
                    date_col = c
                    break
            
            cat_col2 = date_col if date_col else categorical_cols[1]
            num_col2 = numeric_cols[-1] if len(numeric_cols) > 1 else numeric_cols[0]
            
            grouped2 = df.groupby(cat_col2)[num_col2].sum().head(20) # Just take first 20 for simplicity
            line_data = {
                'title': f'{num_col2} over {cat_col2}',
                'labels': [str(x) for x in grouped2.index.tolist()],
                'values': grouped2.values.tolist(),
                'cat_col': cat_col2,
                'num_col': num_col2
            }

        return jsonify({
            'kpis': kpis[:5],
            'bar_chart': bar_data,
            'line_chart': line_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': str(e)}), 500

@app.route('/api/filters/<int:dataset_id>', methods=['GET'])
@token_required
def get_filters(current_user, dataset_id):
    ds = Dataset.query.get(dataset_id)
    if not ds:
        return jsonify({'message': 'Dataset not found'}), 404
        
    filepath = os.path.join(UPLOAD_FOLDER, ds.filename)
    if not os.path.exists(filepath):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        df = pd.read_csv(filepath)
        df = df.dropna(how='all')
        
        filters = []
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        
        # Add categorical and low-cardinality columns
        for col in list(df.columns):
            if 'id' in col.lower() or 'zip' in col.lower():
                continue
            
            # If it's categorical with low cardinality, or just any low cardinality column (e.g. Month, Year)
            if df[col].nunique() > 0 and df[col].nunique() <= 50:
                # Convert to string and sort
                unique_vals = sorted([str(x) for x in df[col].dropna().unique()])
                filters.append({
                    'column': col,
                    'values': unique_vals
                })
        
        # Return top 5 most relevant filters to not overwhelm UI
        return jsonify(filters[:5])
    except Exception as e:
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
