from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from app import app, db  # Assuming your main file is named app.py
from app import ProjectTemplate, StepTemplate, TaskTemplate, Project  # Import your models

admin = Admin(app, name='CMS', template_mode='bootstrap3')

# Add model views
admin.add_view(ModelView(ProjectTemplate, db.session))
admin.add_view(ModelView(StepTemplate, db.session))
admin.add_view(ModelView(TaskTemplate, db.session))
admin.add_view(ModelView(Project, db.session))
