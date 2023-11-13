from flask import Flask, render_template, request, jsonify, redirect, url_for, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from flask_migrate import Migrate
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from flask_admin.contrib.sqla import ModelView
import openai
import os
from werkzeug.security import generate_password_hash, check_password_hash
import boto3
from botocore.exceptions import NoCredentialsError
import uuid
import markdown.extensions.fenced_code
from markdown import markdown
from datetime import datetime


#INITIALIZATIONS

#Flask & Postgres Configurations
app = Flask(__name__)
app.secret_key = os.environ.get("secret_key", "secret_default_key")
database_uri = os.environ.get('DATABASE_URL').replace("postgres://", "postgresql://",1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_uri
db = SQLAlchemy(app)
migrate = Migrate(app, db)

#S3 Configurations
app.config['S3_BUCKET'] = os.environ.get('S3_BUCKET')
app.config['S3_KEY'] = os.environ.get('S3_KEY')
app.config['S3_SECRET'] = os.environ.get('S3_SECRET')
app.config['S3_REGION'] = os.environ.get('S3_REGION')

#Login Management
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'index'


#OpenAI API Key

openai.api_key = os.environ.get("OPENAI_KEY")

#S3 Client Connection
s3 = boto3.client(
   "s3",
   aws_access_key_id=app.config["S3_KEY"],
   aws_secret_access_key=app.config["S3_SECRET"],
   region_name=app.config["S3_REGION"]
)

#DATABASE MODELS
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    first_name = db.Column(db.String(150), nullable=False)
    last_name = db.Column(db.String(150), nullable=False)
    last_page = db.Column(db.String(150), nullable=True)  # To store last page user was on

class ProjectTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    companyOverview = db.Column(db.String(1500))
    objective = db.Column(db.String(1500))
    steps = db.relationship('StepTemplate', back_populates='project_template', lazy=True)

class StepTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(500))
    project_template_id = db.Column(db.Integer, db.ForeignKey('project_template.id'), nullable=False)
    tasks = db.relationship('TaskTemplate', back_populates='step_template', lazy=True)
    project_template = db.relationship('ProjectTemplate', back_populates='steps')

    
class TaskTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    step_template_id = db.Column(db.Integer, db.ForeignKey('step_template.id'), nullable=False)
    step_template = db.relationship('StepTemplate', back_populates='tasks')
    input_type = db.Column(db.String, nullable=False, default='text')  # Added default value
    case_study_endpoint = db.Column(db.String, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)


class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('project_template.id'), nullable=False)
    tasks = db.relationship('Task', backref='project', lazy=True)
    problem_statement = db.Column(db.Text, nullable=True)
    is_public = db.Column(db.Boolean, default=False, nullable=False)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    link = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('task_template.id'), nullable=False)

class Thread(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Relationships
    messages = db.relationship('Message', backref='thread', lazy=True) 

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey('thread.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    role = db.Column(db.String(50), nullable=False)  # 'user' or 'assistant'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserView(ModelView):
    column_display_pk = True  # Display primary key in the list view
    column_exclude_list = ['password']  # Exclude the password field for security reasons
    form_excluded_columns = ['password']  # Exclude the password field from the form


class ProjectTemplateView(ModelView):
    column_display_pk = True  # Display primary key in the list view

class StepTemplateView(ModelView):
    column_display_pk = True
    column_auto_select_related = True  # Automatically join and display related fields in the list view
    form_ajax_refs = {
        'project_template': {
            'fields': ['title'],
            'page_size': 10
        }
    }

class TaskTemplateView(ModelView):
    column_display_pk = True
    column_auto_select_related = True
    form_ajax_refs = {
        'step_template': {
            'fields': ['title'],
            'page_size': 10
        }
    }

def init_cms(app):
    admin = Admin(app, name='CMS', template_mode='bootstrap3')
    admin.add_view(UserView(User, db.session))
    admin.add_view(ProjectTemplateView(ProjectTemplate, db.session))
    admin.add_view(StepTemplateView(StepTemplate, db.session))
    admin.add_view(TaskTemplateView(TaskTemplate, db.session))

init_cms(app)

#KEY PAGES
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route("/signup", methods=['GET', 'POST'])
def signup():
    # Handle signup logic
    if request.method == 'POST':
        email = request.form.get('email')
        first_name = request.form.get('first_name')
        last_name = request.form.get('last_name')
        password = generate_password_hash(request.form.get('password'), method='sha256')

        new_user = User(email=email, first_name=first_name, last_name=last_name, password=password)
        db.session.add(new_user)
        db.session.commit()
        login_user(new_user)
        return redirect(url_for('index'))
    return render_template("signup.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route("/", methods=['GET', 'POST'])
def index():
    if current_user.is_authenticated:
        # If user is already logged in, redirect to projects page
        return redirect(url_for('projects'))

    # Handle login logic here
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user:
            if check_password_hash(user.password, password):
                login_user(user)
                return redirect(url_for('projects'))
    return render_template("index.html")  # Login page

@app.route("/tutorial")
def tutorial():
    return render_template("tutorial.html")

@app.route("/projects")
@login_required
def projects():
    all_projects = ProjectTemplate.query.all()
    return render_template("projects.html", projects=all_projects)


@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data.get('question', '')
    projectBrief = 'We are a leading company specializing in creating chatbots for virtual educational organizations, including bootcamps, online universities, and homeschooling platforms. Our mission is to enhance the educational experience through intuitive and AI-powered chatbot solutions.'#data.get('projectBrief', '')
    objective = 'Design a customizable chatbot that aligns with each clients branding. This chatbot should cater to educational programs serving people of all ages. The primary goal is to facilitate efficient communication between teachers and students, with features that aid in teaching and learning.'#data.get('objective', '')
    previous_interactions = data.get('previous_interactions', [])  # A list to hold previous Q&A pairs.
    
    context = f"Company Overview: {projectBrief}\nObjective: {objective}"
    interactions = "\n".join(previous_interactions)
    
    prompt = f"{context}\n{interactions}\n\nQuestion from the user: {question}\n Based on the context provided, " \
             "please do not simply restate the problem. Instead, provide a specific, clear, " \
             "and actionable response or suggest the next steps that can be taken to solve the problem. " \
             "If the context is not sufficient to answer, please ask clarifying questions to get more information."
    
    #prompt = f"{context}\n\nUser: {question}\nAI:"
    try:
        response = openai.ChatCompletion.create(
            model = 'gpt-4-1106-preview',
            messages =[
                {
                    "role": "user",
                    "content": question
                },
                {
                    "role":"assistant",
                    "content": "Using the following information, provide a clear answer that helps the user complete the Task they're on."
                },
                {
                    "role": "assistant",
                    "content": projectBrief
                },
                {
                    "role": "assistant",
                    "content": objective 
                },
                {
                    "role":"assistant",
                    "content":"They are on Step 1: Empathsize and working on Task  2  Analyze your notes and draft 2-3 user personas. Use this Figma template to structure and present your personas."
                }

            ],
            temperature=1,
            max_tokens=700,
        )
        print("OpenAI Response: ", response.choices)  # Add this line

        
        answer = response.choices[0].message['content'].strip()
        new_interaction = f"User: {question}\nAI: {answer}"
        previous_interactions.append(new_interaction)
        print(answer)
        return jsonify({"answer": answer, "previous_interactions": previous_interactions})
    except Exception as e:
        return jsonify({"error": str(e)}), 400



#def summarize_text(text):
    prompt = f"Concisely summarize the following into 2-3 sentences: {text}"
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {
                "role": "user",
                "content": prompt
            },
        ],
        temperature=1,
        max_tokens=700
    )

    return response.choices[0].message['content'].strip()

@app.route('/submit_tasks', methods=['POST'])
@login_required
def submit_tasks():
    project_template_id = request.form.get('project_template_id')
    
    print(f"Checking for project with user ID {current_user.id} and template ID {project_template_id}")
    
    # Check if a project exists for the user and the selected template
    user_project = Project.query.filter_by(user_id=current_user.id, template_id=project_template_id).first()
    
    # If there's no project for this user and template, create one
    if not user_project:
        user_project = Project(user_id=current_user.id, template_id=project_template_id)
        db.session.add(user_project)
        db.session.commit()

    # Extract task_ids from the form data
    task_ids = {int(key.split('taskInput')[1]) for key in request.form.keys() if key.startswith('taskInput')}
    task_ids.update({int(key.split('taskFile')[1]) for key in request.files.keys() if key.startswith('taskFile')})

    #Problem Statement
    problem_statement = request.form.get('problem_statement')
    
    print(f"Extracted task IDs: {task_ids}")
    print(problem_statement)

    if problem_statement and problem_statement != user_project.problem_statement:
        user_project.problem_statement = problem_statement

    for task_id in task_ids:
        task_template = TaskTemplate.query.get(task_id)
        if not task_template:
            continue  # Skip if this task_id doesn't exist
        
        if task_template.input_type == 'text':
            input_data = request.form.get(f'taskInput{task_id}')
            existing_task = Task.query.filter_by(project_id=user_project.id, template_id=task_id).first()
            
            if existing_task:
                print(f"Updating existing text task with ID {task_id} and link {input_data}")
                if input_data != existing_task.link:
                    existing_task.link = input_data
            else:
                print(f"Creating new text task with ID {task_id} and link {input_data}")
                new_task = Task(link=input_data, project_id=user_project.id, template_id=task_id)
                db.session.add(new_task)
        else:
            file = request.files.get(f'taskFile{task_id}')
            if file:
                # Generate unique filename using UUID
                file_ext = file.filename.split('.')[-1]
                filename = f"{user_project.id}_{task_id}_{uuid.uuid4().hex}.{file_ext}"

                try:
                    s3.upload_fileobj(
                        file,
                        app.config['S3_BUCKET'],
                        filename,
                        ExtraArgs={
                            "ContentType": file.content_type
                        }
                    )
                    print(f"Uploaded file for task ID {task_id} to S3 with filename {filename}")
                except NoCredentialsError:
                    print("Error: Missing AWS Credentials")
                    return jsonify(success=False, error="Missing AWS Credentials"), 500
                except Exception as e:
                    print(f"Error uploading to S3: {e}")
                    return jsonify(success=False, error=str(e)), 500

                link = filename
                existing_task = Task.query.filter_by(project_id=user_project.id, template_id=task_id).first()
                
                if existing_task:
                    print(f"Updating existing file task with ID {task_id} and link {link}")
                    existing_task.link = link
                else:
                    print(f"Creating new file task with ID {task_id} and link {link}")
                    new_task = Task(link=link, project_id=user_project.id, template_id=task_id)
                    db.session.add(new_task)

    try:
        db.session.commit()
        print("Tasks successfully updated/created.")
        return jsonify(success=True)
    except Exception as e:
        db.session.rollback()
        print(f"Error while updating/creating tasks: {e}")
        return jsonify(success=False, error="Database error: " + str(e)), 500

#DATABASE & CASE STUDY ROUTES
def generate_presigned_url(bucket_name, object_name, expiration=3600):
    """
    Generate a pre-signed URL to share an S3 object
    :param bucket_name: string
    :param object_name: string
    :param expiration: Time in seconds for the pre-signed URL to remain valid
    :return: Pre-signed URL as string. If error, returns None.
    """
    # Generate a pre-signed URL for the S3 object
    s3_client = boto3.client(
        's3',
        aws_access_key_id=app.config['S3_KEY'],
        aws_secret_access_key=app.config['S3_SECRET'],
        region_name=app.config['S3_REGION']
    )
    try:
        response = s3_client.generate_presigned_url('get_object',
                                                    Params={'Bucket': bucket_name,
                                                            'Key': object_name},
                                                    ExpiresIn=expiration)
    except NoCredentialsError:
        print("Credentials not available")
        return None

    return response

@app.route('/make_project_public', methods=['POST'])
def make_project_public():
    if not current_user.is_authenticated:
        return jsonify(success=False), 401

    data = request.get_json()
    project_id = data.get('project_id')
    project = Project.query.get(project_id)
    if not project:
        return jsonify(success=False, message="Project not found."), 404

    if project.user_id != current_user.id:
        return jsonify(success=False, message="Access denied."), 404

    project.is_public = True
    db.session.commit()
    return jsonify(success=True)



@app.route('/result/<int:project_id>')
def case_study(project_id):
    # Fetch the specified project by ID regardless of user
    user_project = Project.query.get(project_id)

    # If the project doesn't exist or isn't public and the user isn't the owner, redirect to home
    if not user_project or (not user_project.is_public and (current_user.is_anonymous or (current_user.is_authenticated and user_project.user_id != current_user.id))):
        flash('This project is not available.', 'danger')
        return redirect(url_for('home'))

    tasks_by_endpoint = {}
    for task in user_project.tasks:
        task_template = TaskTemplate.query.get(task.template_id)
        
        # If the task is a file, generate a presigned URL for S3 resources
        # Check if the user is authenticated and is the owner before generating presigned URL
        if task_template.input_type == "file" and current_user.is_authenticated and user_project.user_id == current_user.id:
            presigned_url = generate_presigned_url(app.config['S3_BUCKET'], task.link)
            task.link = presigned_url

        tasks_by_endpoint[task_template.case_study_endpoint] = task

    required_endpoints = ['user_interviews', 'secondary_research', 'affinity_map', 'empathy_map', 'user_stories', 'competitive_research', 'lofi_wireframe', 'mood_board', 'style_guide', 'designs', 'reflection']

    # Fill missing endpoints with a default message for missing data
    for endpoint in required_endpoints:
        if endpoint not in tasks_by_endpoint:
            default_task = Task(link="No data available")  # Create a default Task instance with a placeholder message
            tasks_by_endpoint[endpoint] = default_task

    project_template = ProjectTemplate.query.get(user_project.template_id)
    
    # Render the case study page with the project and task data
    return render_template('case_study.html', user_project=user_project, tasks_by_endpoint=tasks_by_endpoint, project_template=project_template)

@app.template_filter('markdown')
def markdown_to_html(text):
    return markdown(text, extensions=['fenced_code', 'tables'])

#This adds a filter to enable markdown. 
app.jinja_env.filters['markdown'] = markdown_to_html

#This function loads projects into the dropdown on /project
@app.route("/load_project", methods=['POST'])
@login_required
def load_project():
    project_id = request.form.get('project')
    return redirect(url_for('project', project_template_id=project_id))


@app.route("/project/<int:project_template_id>")
@login_required
def project(project_template_id):
    project_template = ProjectTemplate.query.get_or_404(project_template_id)

    # Fetch the user's projects and tasks for this specific project template
    user_project = Project.query.filter_by(user_id=current_user.id, template_id=project_template_id).first()
    
    # If no user project exists for this template, create one
    if not user_project:
        user_project = Project(user_id=current_user.id, template_id=project_template_id)
        db.session.add(user_project)
        db.session.commit()
        user_tasks = {}
    else:
        user_tasks = {task.template_id: task.link for task in user_project.tasks}
        
    # Debugging print statements
    print(f"User ID: {current_user.id}, Project Template ID: {project_template_id}")
    print("User Project:", user_project)
    print("User Tasks:", user_tasks)
    project_id = user_project.id

    user_problem_statement = user_project.problem_statement if user_project else None
    return render_template("project.html", project_template=project_template, user_tasks=user_tasks, project_template_id=project_template_id, project_id=project_id, user_problem_statement=user_problem_statement, user_project=user_project)


if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

