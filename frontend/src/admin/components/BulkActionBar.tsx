import React from 'react';

export interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onSuspend: () => void;
  onResetQuota: () => void;
  onClear: () => void;
}


function BulkActionBar(props: BulkActionBarProps) {
  const { selectedCount, onDelete, onSuspend, onResetQuota, onClear } = props;
  if (selectedCount === 0) return null;
  return (
    <div className="flex items-center space-x-4 bg-blue-50 border border-blue-200 rounded p-2 mb-2">
      <span>{selectedCount} selected</span>
      <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={onDelete}>Delete</button>
      <button className="bg-yellow-500 text-white px-3 py-1 rounded" onClick={onSuspend}>Suspend</button>
      <button className="bg-blue-700 text-white px-3 py-1 rounded" onClick={onResetQuota}>Reset Quota</button>
      <button className="bg-gray-300 text-gray-700 px-3 py-1 rounded" onClick={onClear}>Clear</button>
    </div>
  );
}

export default BulkActionBar;
