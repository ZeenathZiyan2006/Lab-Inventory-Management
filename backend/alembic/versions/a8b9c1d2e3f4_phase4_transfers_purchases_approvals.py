"""phase4_transfers_purchases_approvals

Revision ID: a8b9c1d2e3f4
Revises: 66d108e8362f
Create Date: 2026-10-19 15:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8b9c1d2e3f4'
down_revision: Union[str, Sequence[str], None] = '66d108e8362f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create transfer_approval_decisions
    op.create_table(
        'transfer_approval_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transfer_id', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.Integer(), nullable=False),
        sa.Column('role_at_approval', sa.String(length=50), nullable=False),
        sa.Column('stage', sa.String(length=80), nullable=False),
        sa.Column('decision', sa.String(length=50), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['transfer_id'], ['transfer_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('transfer_approval_decisions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_transfer_approval_decisions_id'), ['id'], unique=False)

    # 2. Create transfer_status_history
    op.create_table(
        'transfer_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transfer_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('previous_status', sa.String(length=80), nullable=True),
        sa.Column('new_status', sa.String(length=80), nullable=False),
        sa.Column('action', sa.String(length=80), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['transfer_id'], ['transfer_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('transfer_status_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_transfer_status_history_id'), ['id'], unique=False)

    # 3. Create purchase_approval_decisions
    op.create_table(
        'purchase_approval_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_id', sa.Integer(), nullable=False),
        sa.Column('approver_id', sa.Integer(), nullable=False),
        sa.Column('role_at_approval', sa.String(length=50), nullable=False),
        sa.Column('stage', sa.String(length=80), nullable=False),
        sa.Column('decision', sa.String(length=50), nullable=False),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchase_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('purchase_approval_decisions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_purchase_approval_decisions_id'), ['id'], unique=False)

    # 4. Create goods_receipt_records
    op.create_table(
        'goods_receipt_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_id', sa.Integer(), nullable=False),
        sa.Column('received_by_id', sa.Integer(), nullable=False),
        sa.Column('quantity_received', sa.Integer(), nullable=False),
        sa.Column('condition_received', sa.String(length=80), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchase_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['received_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('goods_receipt_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_goods_receipt_records_id'), ['id'], unique=False)

    # 5. Create purchase_status_history
    op.create_table(
        'purchase_status_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('purchase_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('previous_status', sa.String(length=80), nullable=True),
        sa.Column('new_status', sa.String(length=80), nullable=False),
        sa.Column('action', sa.String(length=80), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchase_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('purchase_status_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_purchase_status_history_id'), ['id'], unique=False)

    # 6. Create stock_movement_ledger
    op.create_table(
        'stock_movement_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('item_type', sa.String(length=50), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('item_name', sa.String(length=150), nullable=False),
        sa.Column('from_lab_id', sa.Integer(), nullable=True),
        sa.Column('to_lab_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('reference_type', sa.String(length=80), nullable=False),
        sa.Column('reference_id', sa.String(length=80), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['from_lab_id'], ['laboratories.id'], ),
        sa.ForeignKeyConstraint(['to_lab_id'], ['laboratories.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stock_movement_ledger', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stock_movement_ledger_id'), ['id'], unique=False)

    # 7. Add columns to transfer_requests
    with op.batch_alter_table('transfer_requests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('priority', sa.String(length=50), server_default='Normal', nullable=False))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('dispatch_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('receipt_condition', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column('receipt_discrepancy_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('rejection_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('cancellation_reason', sa.Text(), nullable=True))

    # 8. Add columns to purchase_requests
    with op.batch_alter_table('purchase_requests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('request_type', sa.String(length=50), server_default='New Purchase', nullable=False))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('unit', sa.String(length=50), server_default='Units', nullable=False))
        batch_op.add_column(sa.Column('estimated_unit_cost', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('estimated_total_cost', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('linked_asset_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('supplier_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('supplier_contact', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('quotation_ref', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('attachment_url', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('rejection_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('more_info_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('po_number', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('ordered_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('ordered_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('ordered_cost', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('expected_delivery_date', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('order_notes', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('quantity_received', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('quantity_outstanding', sa.Integer(), server_default='1', nullable=False))
        batch_op.create_foreign_key('fk_purchase_requests_linked_asset', 'assets', ['linked_asset_id'], ['id'])
        batch_op.create_foreign_key('fk_purchase_requests_ordered_by', 'users', ['ordered_by_id'], ['id'])


def downgrade() -> None:
    pass
