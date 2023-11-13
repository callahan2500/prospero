"""Add soft delete to TaskTemplate

Revision ID: b30a2ffe60e8
Revises: 7c342749e703
Create Date: 2023-11-12 16:59:45.783994

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b30a2ffe60e8'
down_revision = '7c342749e703'
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Add the column without NOT NULL constraint
    op.add_column('task_template', sa.Column('is_deleted', sa.Boolean(), nullable=True))
    
    # Step 2: Update the table to set a default value for existing rows
    op.execute('UPDATE task_template SET is_deleted = False WHERE is_deleted IS NULL')
    
    # Step 3: Alter the column to add the NOT NULL constraint
    op.alter_column('task_template', 'is_deleted', existing_type=sa.Boolean(), nullable=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('task_template', schema=None) as batch_op:
        batch_op.drop_column('is_deleted')

    # ### end Alembic commands ###