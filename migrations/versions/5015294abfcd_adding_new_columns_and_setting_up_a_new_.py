"""adding new columns and setting up a new db

Revision ID: 5015294abfcd
Revises: 
Create Date: 2023-10-09 16:26:55.601874

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5015294abfcd'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('project_template',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=150), nullable=False),
    sa.Column('companyOverview', sa.String(length=1000), nullable=True),
    sa.Column('objective', sa.String(length=1000), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=150), nullable=False),
    sa.Column('password', sa.String(length=150), nullable=False),
    sa.Column('first_name', sa.String(length=150), nullable=False),
    sa.Column('last_name', sa.String(length=150), nullable=False),
    sa.Column('last_page', sa.String(length=150), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('project',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['template_id'], ['project_template.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('step_template',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=150), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('project_template_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['project_template_id'], ['project_template.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('task_template',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=False),
    sa.Column('step_template_id', sa.Integer(), nullable=False),
    sa.Column('input_type', sa.String(), nullable=False),
    sa.Column('case_study_endpoint', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['step_template_id'], ['step_template.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('task',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('link', sa.String(length=500), nullable=True),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['project.id'], ),
    sa.ForeignKeyConstraint(['template_id'], ['task_template.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('task')
    op.drop_table('task_template')
    op.drop_table('step_template')
    op.drop_table('project')
    op.drop_table('user')
    op.drop_table('project_template')
    # ### end Alembic commands ###