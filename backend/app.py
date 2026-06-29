from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
import datetime
from functools import wraps
import pandas as pd
import os
from flask_migrate import Migrate
import shutil
import uuid
from dotenv import load_dotenv

def load_df(filepath, **kwargs):
    if filepath.endswith('.csv'):
        return pd.read_csv(filepath, **kwargs)
    elif filepath.endswith(('.xlsx', '.xls')):
        return pd.read_excel(filepath, **kwargs)
    raise ValueError("Unsupported file format")

load_dotenv()

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

# Database configuration (PostgreSQL production / SQLite fallback)
database_url = os.getenv('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

if not database_url:
    # Use a persistent local file instead of purely ephemeral memory or arbitrary working dir
    os.makedirs(app.instance_path, exist_ok=True)
    database_url = 'sqlite:///' + os.path.join(app.instance_path, 'app.db')

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "change-this-in-production")

# Permanent Upload Storage (Read from .env or fallback to local instance storage)
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(app.instance_path, 'uploads'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)
migrate = Migrate(app, db)

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
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dataset_name = db.Column(db.String(100), nullable=False)
    file_name = db.Column(db.String(200), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)
    rows = db.Column(db.Integer, nullable=True)
    columns = db.Column(db.Integer, nullable=True)
    upload_date = db.Column(db.Date, default=lambda: datetime.datetime.utcnow().date())
    upload_time = db.Column(db.Time, default=lambda: datetime.datetime.utcnow().time())
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    status = db.Column(db.String(50), default='Uploaded')

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

ROLE_PERMISSIONS = {
    'Admin': ['can_view_data', 'can_upload_data', 'can_manage_users', 'can_delete_data', 'can_download_data', 'can_edit_data'],
    'Manager': ['can_view_data', 'can_upload_data', 'can_download_data', 'can_edit_data'],
    'Data Engineer': ['can_view_data', 'can_upload_data', 'can_download_data', 'can_edit_data'],
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

# CLI Command for initializing admin user
import click
from flask.cli import with_appcontext

@app.cli.command("init-admin")
@with_appcontext
def init_admin():
    """Create initial admin user."""
    if not User.query.filter_by(role='Admin').first():
        hashed_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
        admin = User(username='admin', password_hash=hashed_pw, role='Admin', department='IT', clearance_level=5)
        db.session.add(admin)
        db.session.commit()
        print("Admin user created.")
    else:
        print("Admin user already exists.")
    
@app.route('/')
def home():
    return jsonify({"status": "Backend is running!"}), 200

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
    
    # Notify Admins and Managers
    admins_managers = User.query.filter(User.role.in_(['Admin', 'Manager'])).all()
    for u in admins_managers:
        notif = Notification(user_id=u.id, message=f"A new user '{username}' has just registered.")
        db.session.add(notif)
        
    db.session.commit()
    return jsonify({'message': 'User registered successfully'})

@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    notifs = Notification.query.filter_by(user_id=current_user.id, is_read=False).order_by(Notification.timestamp.desc()).all()
    return jsonify([{
        'id': n.id,
        'message': n.message,
        'timestamp': n.timestamp.isoformat()
    } for n in notifs])

@app.route('/api/notifications/<int:notif_id>/read', methods=['PUT'])
@token_required
def read_notification(current_user, notif_id):
    notif = Notification.query.get(notif_id)
    if notif and notif.user_id == current_user.id:
        notif.is_read = True
        db.session.commit()
        return jsonify({'message': 'Marked as read'})
    return jsonify({'message': 'Notification not found'}), 404

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

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
@permission_required('can_manage_users')
def update_user(current_user, user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
        
    data = request.get_json()
    if 'role' in data:
        user.role = data['role']
    if 'job_role' in data:
        user.job_role = data['job_role']
    if 'job_location' in data:
        user.job_location = data['job_location']
    if 'department' in data:
        user.department = data['department']
    if 'clearance_level' in data:
        user.clearance_level = int(data['clearance_level'])
        
    db.session.commit()
    return jsonify({'message': 'User updated successfully'})

@app.route('/api/datasets', methods=['GET'])
@token_required
@permission_required('can_view_data')
def get_datasets(current_user):
    # Strict isolation: A user can only see their own datasets.
    datasets = Dataset.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': d.id,
        'dataset_name': d.dataset_name,
        'file_name': d.file_name,
        'file_size': d.file_size,
        'rows': d.rows,
        'columns': d.columns,
        'upload_date': d.upload_date.isoformat() if d.upload_date else None,
        'upload_time': d.upload_time.isoformat() if d.upload_time else None,
        'status': d.status
    } for d in datasets])

@app.route('/api/upload', methods=['POST'])
@token_required
@permission_required('can_upload_data')
def upload_data(current_user):
    if 'file' not in request.files:
        return jsonify({'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
        
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls']:
        return jsonify({'message': 'Unsupported file format'}), 400

    try:
        filename = f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        
        # Read file to get rows and columns
        df = load_df(filepath)
        rows, columns = df.shape
        
        ds = Dataset(
            user_id=current_user.id,
            dataset_name=request.form.get('dataset_name', file.filename),
            file_name=filename,
            file_path=filepath,
            file_size=file_size,
            rows=rows,
            columns=columns,
            status='Ready'
        )
        db.session.add(ds)
        db.session.commit()
        return jsonify({'message': 'Dataset uploaded successfully'})
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/datasets/<int:dataset_id>', methods=['DELETE'])
@token_required
@permission_required('can_delete_data')
def delete_dataset(current_user, dataset_id):
    ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not ds:
        return jsonify({'message': 'Dataset not found or access denied'}), 404
        
    try:
        if os.path.exists(ds.file_path):
            os.remove(ds.file_path)
            
        db.session.delete(ds)
        db.session.commit()
        return jsonify({'message': 'Dataset deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@app.route('/api/datasets/<int:dataset_id>/download', methods=['GET'])
@token_required
@permission_required('can_download_data')
def download_dataset(current_user, dataset_id):
    ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not ds:
        return jsonify({'message': 'Dataset not found or access denied'}), 404
    if not os.path.exists(ds.file_path):
        return jsonify({'message': 'File missing'}), 404
    return send_file(ds.file_path, as_attachment=True, download_name=ds.file_name)

@app.route('/api/datasets/<int:dataset_id>', methods=['PUT'])
@token_required
@permission_required('can_edit_data')
def update_dataset(current_user, dataset_id):
    ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not ds:
        return jsonify({'message': 'Dataset not found or access denied'}), 404
        
    data = request.get_json()
    if data and 'dataset_name' in data:
        ds.dataset_name = data['dataset_name']
        db.session.commit()
        return jsonify({'message': 'Dataset renamed successfully'})
    return jsonify({'message': 'No update parameters provided'}), 400

@app.route('/api/upload_temp', methods=['POST'])
@token_required
def upload_temp_data(current_user):
    if 'file' not in request.files:
        return jsonify({'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
        
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.csv', '.xlsx', '.xls']:
        return jsonify({'message': 'Only CSV and Excel files allowed'}), 400
        
    try:
        temp_id = f"temp_{uuid.uuid4().hex}"
        filename = f"{temp_id}{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Verify it's readable
        df = load_df(filepath, nrows=5)
        
        return jsonify({
            'id': temp_id,
            'name': f"Temporary: {file.filename}"
        })
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/insights/<dataset_id>', methods=['GET'])
@token_required
def get_insights(current_user, dataset_id):
    if str(dataset_id).startswith('temp_'):
        filename = None
        for ext in ['.csv', '.xlsx', '.xls']:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, f"{dataset_id}{ext}")):
                filename = f"{dataset_id}{ext}"
                break
        if not filename:
            return jsonify({'message': 'Temporary file missing or expired'}), 404
        filepath = os.path.join(UPLOAD_FOLDER, filename)
    else:
        ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
        if not ds:
            return jsonify({'message': 'Dataset not found or access denied'}), 404
        filepath = ds.file_path
        
    if not os.path.exists(filepath):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        # Load dataset
        df = load_df(filepath)
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

@app.route('/api/filters/<dataset_id>', methods=['GET'])
@token_required
def get_filters(current_user, dataset_id):
    if str(dataset_id).startswith('temp_'):
        filename = None
        for ext in ['.csv', '.xlsx', '.xls']:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, f"{dataset_id}{ext}")):
                filename = f"{dataset_id}{ext}"
                break
        if not filename:
            return jsonify({'message': 'Temporary file missing or expired'}), 404
        filepath = os.path.join(UPLOAD_FOLDER, filename)
    else:
        ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
        if not ds:
            return jsonify({'message': 'Dataset not found or access denied'}), 404
        filepath = ds.file_path
        
    if not os.path.exists(filepath):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        df = load_df(filepath)
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

@app.route('/api/audit/<dataset_id>', methods=['POST'])
@token_required
def perform_audit(current_user, dataset_id):
    data = request.json
    action = data.get('action')
    
    perms = get_user_permissions(current_user.role)
    if action not in perms:
        return jsonify({'message': 'Permission denied for this audit action'}), 403
        
    if str(dataset_id).startswith('temp_'):
        filename = None
        for ext in ['.csv', '.xlsx', '.xls']:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, f"{dataset_id}{ext}")):
                filename = f"{dataset_id}{ext}"
                break
        if not filename:
            return jsonify({'message': 'Temporary file missing or expired'}), 404
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        ds_name = f"Temporary Dataset: {dataset_id}"
    else:
        ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
        if not ds:
            return jsonify({'message': 'Dataset not found or access denied'}), 404
                
        filepath = ds.file_path
        ds_name = ds.dataset_name
        
    if not os.path.exists(filepath):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        df = load_df(filepath)
        df = df.dropna(how='all')
        
        result_text = ""
        
        if action == 'can_assess_risk':
            missing_pct = (df.isnull().sum() / len(df)) * 100
            high_missing = missing_pct[missing_pct > 10]
            if high_missing.empty:
                result_text = "Low Risk: No columns have more than 10% missing data."
            else:
                result_text = "High Risk Identified! Columns with >10% missing data:\n"
                for col, pct in high_missing.items():
                    result_text += f"- {col}: {pct:.1f}%\n"
                    
        elif action == 'can_test_controls':
            num_cols = df.select_dtypes(include=['number']).columns
            if len(num_cols) == 0:
                result_text = "No numeric columns to test controls."
            else:
                negative_counts = (df[num_cols] < 0).sum()
                has_negatives = negative_counts[negative_counts > 0]
                if has_negatives.empty:
                    result_text = "Controls Verified: No unexpected negative values found in numeric columns."
                else:
                    result_text = "Control Failure! Negative values found in:\n"
                    for col, cnt in has_negatives.items():
                        result_text += f"- {col}: {cnt} rows\n"
                    
        elif action == 'can_gather_evidence':
            num_cols = df.select_dtypes(include=['number']).columns
            if len(num_cols) == 0:
                result_text = "No numeric financial data available to aggregate."
            else:
                sums = df[num_cols].sum().sort_values(ascending=False).head(3)
                result_text = "Financial Evidence Gathered (Top 3 Metrics):\n"
                for col, val in sums.items():
                    result_text += f"- Total {col}: {val:,.2f}\n"
                    
        elif action == 'can_verify_accuracy':
            num_cols = df.select_dtypes(include=['number']).columns
            if len(num_cols) == 0:
                result_text = "No numeric data to verify accuracy."
            else:
                std_devs = df[num_cols].std().dropna()
                result_text = "Accuracy Variance (Standard Deviations):\n"
                for col, val in std_devs.head(5).items():
                    result_text += f"- {col}: ±{val:,.2f}\n"
                    
        elif action == 'can_ensure_compliance':
            sensitive_keywords = ['email', 'ssn', 'phone', 'address', 'name', 'ip']
            found_cols = [col for col in df.columns if any(kw in col.lower() for kw in sensitive_keywords)]
            if found_cols:
                result_text = "Compliance Warning! Potential PII detected in columns:\n"
                result_text += ", ".join(found_cols)
                result_text += "\nEnsure these columns are properly masked or encrypted."
            else:
                result_text = "Compliance Check Passed: No obvious PII column headers detected."
                
        elif action == 'can_issue_opinion':
            cat_cols = df.select_dtypes(include=['object', 'category']).columns
            if len(cat_cols) == 0:
                result_text = "Data is balanced (No categorical variables to skew)."
            else:
                skewed = []
                for col in cat_cols:
                    top_freq = df[col].value_counts(normalize=True).max()
                    if top_freq > 0.90:
                        skewed.append(col)
                if skewed:
                    result_text = "Auditor Opinion: Data is heavily skewed/biased in categories:\n" + ", ".join(skewed)
                else:
                    result_text = "Auditor Opinion: Certified Fair. Categorical data is reasonably balanced."
                    
        elif action == 'can_report_findings':
            import datetime
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            result_text = f"--- AUDITOR FINAL REPORT ---\n"
            result_text += f"Dataset: {ds_name}\n"
            result_text += f"Rows: {len(df):,}\n"
            result_text += f"Columns: {len(df.columns)}\n"
            result_text += f"Audited By: {current_user.username} ({current_user.role})\n"
            result_text += f"Timestamp: {now}\n"
            result_text += f"Status: COMPLETED"
            
        else:
            return jsonify({'message': 'Unknown audit action'}), 400
            
        return jsonify({'message': 'Success', 'result': result_text})
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/datasets/<int:dataset_id>/preview', methods=['GET'])
@token_required
@permission_required('can_view_data')
def preview_dataset(current_user, dataset_id):
    ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not ds:
        return jsonify({'message': 'Dataset not found or access denied'}), 404
        
    if not os.path.exists(ds.file_path):
        return jsonify({'message': 'File missing'}), 404
        
    try:
        df = load_df(ds.file_path)
        
        # First 20 rows
        head_data = df.head(20).fillna("").to_dict(orient='records')
        
        # Stats
        missing_values = int(df.isnull().sum().sum())
        duplicates = int(df.duplicated().sum())
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}
        
        # Null value statistics per column
        null_stats = df.isnull().sum().to_dict()
        null_stats = {k: int(v) for k, v in null_stats.items()}
        
        # Basic descriptive statistics (numeric only, json-safe)
        desc_stats = df.describe().fillna("").to_dict()
        
        return jsonify({
            'head': head_data,
            'columns': list(df.columns),
            'rows_count': int(df.shape[0]),
            'cols_count': int(df.shape[1]),
            'missing_values_total': missing_values,
            'duplicates': duplicates,
            'data_types': dtypes,
            'null_stats': null_stats,
            'desc_stats': desc_stats
        })
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# BI Integrations (Stubs)
@app.route('/api/datasets/<int:dataset_id>/export/tableau', methods=['POST'])
@token_required
def export_tableau(current_user, dataset_id):
    return jsonify({'message': 'Export to Tableau initiated. Note: Requires Tableau Server credentials.'})

@app.route('/api/datasets/<int:dataset_id>/embed/tableau', methods=['GET'])
@token_required
def embed_tableau(current_user, dataset_id):
    return jsonify({'embed_url': 'https://public.tableau.com/views/Placeholder/Dashboard1', 'message': 'Requires Tableau Embedding API configuration.'})

@app.route('/api/datasets/<int:dataset_id>/export/powerbi', methods=['POST'])
@token_required
def export_powerbi(current_user, dataset_id):
    return jsonify({'message': 'Publish to Power BI Workspace initiated. Note: Requires Power BI Azure AD credentials.'})

@app.route('/api/datasets/<int:dataset_id>/embed/powerbi', methods=['GET'])
@token_required
def embed_powerbi(current_user, dataset_id):
    return jsonify({'embed_url': 'https://app.powerbi.com/reportEmbed?reportId=placeholder', 'message': 'Requires Power BI Embedded SDK configuration.'})

@app.route('/api/datasets/<int:dataset_id>/chart', methods=['POST'])
@token_required
@permission_required('can_view_data')
def get_chart_data(current_user, dataset_id):
    ds = Dataset.query.filter_by(id=dataset_id, user_id=current_user.id).first()
    if not ds:
        return jsonify({'message': 'Dataset not found or access denied'}), 404
        
    if not os.path.exists(ds.file_path):
        return jsonify({'message': 'File missing'}), 404
        
    data = request.json
    chart_type = data.get('chart_type', 'bar')
    x_col = data.get('x_col')
    y_col = data.get('y_col')
    group_col = data.get('group_col')
    agg_func = data.get('agg_func', 'sum')
    filters = data.get('filters', []) # list of {col, op, val}
    
    try:
        df = load_df(ds.file_path)
        
        # Apply filters
        for f in filters:
            col, op, val = f.get('col'), f.get('op'), f.get('val')
            if col and col in df.columns:
                try:
                    if op == '==': df = df[df[col] == val]
                    elif op == '!=': df = df[df[col] != val]
                    elif op == '>': df = df[df[col] > float(val)]
                    elif op == '<': df = df[df[col] < float(val)]
                    elif op == 'in': df = df[df[col].isin(val)]
                except: pass
                
        if df.empty:
            return jsonify({'message': 'No data after filtering', 'data': {}})
            
        result = {}
        
        # Handle correlation matrix specifically
        if chart_type == 'correlation':
            num_cols = df.select_dtypes(include=['number']).columns
            if len(num_cols) < 2:
                return jsonify({'message': 'Need at least 2 numeric columns for correlation'}), 400
            corr = df[num_cols].corr().fillna(0)
            result = {
                'x': list(corr.columns),
                'y': list(corr.index),
                'z': corr.values.tolist(),
                'type': 'heatmap'
            }
            return jsonify({'data': result})
            
        # Basic Validation
        if not x_col or x_col not in df.columns:
            return jsonify({'message': 'Invalid X column'}), 400
            
        # Chart grouping and aggregation
        if chart_type in ['bar', 'line', 'pie', 'donut', 'area', 'treemap']:
            if not y_col or y_col not in df.columns:
                # If no Y col, just do a count of X
                grouped = df.groupby(x_col).size().reset_index(name='count')
                y_col_act = 'count'
            else:
                try:
                    grouped = df.groupby(x_col)[y_col].agg(agg_func).reset_index(name=f"{y_col}_{agg_func}")
                    y_col_act = f"{y_col}_{agg_func}"
                except Exception as e:
                    # fallback if something weird happens with agg
                    grouped = df.groupby(x_col)[y_col].sum().reset_index(name=f"{y_col}_{agg_func}")
                    y_col_act = f"{y_col}_{agg_func}"
                
            grouped = grouped.dropna().sort_values(by=y_col_act, ascending=False).head(100) # Limit to 100 for performance
            
            result = {
                'x': grouped[x_col].tolist(),
                'y': grouped[y_col_act].tolist()
            }
            
            if chart_type == 'pie' or chart_type == 'donut':
                result = {
                    'labels': grouped[x_col].tolist(),
                    'values': grouped[y_col_act].tolist(),
                    'type': 'pie'
                }
                if chart_type == 'donut':
                    result['hole'] = 0.4
                    
        elif chart_type in ['scatter', 'box', 'histogram']:
            # For these, we might want raw data or grouped depending on size
            # Limit to 1000 rows to prevent massive payloads
            sample = df.head(1000)
            result = {
                'x': sample[x_col].tolist(),
            }
            if y_col and y_col in df.columns:
                result['y'] = sample[y_col].tolist()
                
        # Heatmap
        elif chart_type == 'heatmap':
            if not y_col or y_col not in df.columns or not group_col or group_col not in df.columns:
                return jsonify({'message': 'Heatmap requires X, Y, and Group (Z) columns'}), 400
            pivot = df.pivot_table(values=group_col, index=y_col, columns=x_col, aggfunc=agg_func).fillna(0)
            result = {
                'x': list(pivot.columns),
                'y': list(pivot.index),
                'z': pivot.values.tolist(),
                'type': 'heatmap'
            }
            
        return jsonify({'data': result})
        
    except Exception as e:
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
