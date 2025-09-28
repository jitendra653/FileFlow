import React, { useEffect, useState } from 'react';
import { Table, Input, Button, Tag, Select, Modal, Checkbox, message } from 'antd';
import { DownloadOutlined, DeleteOutlined, FilterOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import api from '../../utils/api';

interface FileData {
  _id: string;
  filename: string;
  user: { _id: string; email: string };
  size: number;
  type: string;
  status: string;
  tags: string[];
  uploadedAt: string;
}

const statusOptions = ['active', 'archived', 'deleted'];

const AdminFileTable: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [editModal, setEditModal] = useState<{ open: boolean; file?: FileData }>({ open: false });
  const [users, setUsers] = useState<{ _id: string; email: string }[]>([]);

  useEffect(() => {
    fetchFiles();
    fetchUsers();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
  const res = await api.get('/v1/admin/files');
  setFiles(res.data.files);
    } catch (e) {
      message.error('Failed to fetch files');
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
  const res = await api.get('/v1/admin/users');
  setUsers(res.data.users);
    } catch (e) {}
  };

  const handleDelete = async (ids: string[]) => {
    Modal.confirm({
      title: 'Delete Files',
      content: `Are you sure you want to delete ${ids.length} file(s)?`,
      onOk: async () => {
        try {
          await api.post('/admin/files/bulk-delete', { ids });
          message.success('Files deleted');
          fetchFiles();
          setSelectedRowKeys([]);
        } catch (e) {
          message.error('Delete failed');
        }
      },
    });
  };

  const handleExport = () => {
    // Export filtered files as CSV
    const rows = filteredFiles.map(f => ({
      Filename: f.filename,
      User: f.user.email,
      Size: f.size,
      Type: f.type,
      Status: f.status,
      Tags: f.tags.join(','),
      Uploaded: f.uploadedAt,
    }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'files.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (file: FileData) => {
    setEditModal({ open: true, file });
  };

  const handleSaveEdit = async (updated: FileData) => {
    try {
  await api.put(`/admin/files/${updated._id}`, updated);
      message.success('File updated');
      setEditModal({ open: false });
      fetchFiles();
    } catch (e) {
      message.error('Update failed');
    }
  };

  const filteredFiles = files.filter(f =>
    (!search || f.filename.toLowerCase().includes(search.toLowerCase()) || f.user.email.toLowerCase().includes(search.toLowerCase())) &&
    (!filterUser || f.user._id === filterUser) &&
    (!filterType || f.type === filterType) &&
    (!filterStatus || f.status === filterStatus)
  );

  const columns = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string, record: FileData) => (
        <span style={{ fontWeight: 500 }}>{text}</span>
      ),
    },
    {
      title: 'User',
      dataIndex: ['user', 'email'],
      key: 'user',
      filters: users.map(u => ({ text: u.email, value: u._id })),
      onFilter: (value, record) => record.user._id === value,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      filters: Array.from(new Set(files.map(f => f.type))).map(t => ({ text: t, value: t })),
      onFilter: (value, record) => record.type === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: statusOptions.map(s => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
      render: (status: string) => <Tag color={status === 'active' ? 'green' : status === 'archived' ? 'orange' : 'red'}>{status}</Tag>,
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags.map(tag => <Tag key={tag}>{tag}</Tag>),
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FileData) => (
        <span>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }} />
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete([record._id])} />
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="Search files or users"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <Select
          allowClear
          placeholder="Filter by user"
          style={{ width: 180 }}
          value={filterUser}
          onChange={setFilterUser}
          options={users.map(u => ({ label: u.email, value: u._id }))}
        />
        <Select
          allowClear
          placeholder="Filter by type"
          style={{ width: 140 }}
          value={filterType}
          onChange={setFilterType}
          options={Array.from(new Set(files.map(f => f.type))).map(t => ({ label: t, value: t }))}
        />
        <Select
          allowClear
          placeholder="Filter by status"
          style={{ width: 140 }}
          value={filterStatus}
          onChange={setFilterStatus}
          options={statusOptions.map(s => ({ label: s, value: s }))}
        />
        <Button icon={<ExportOutlined />} onClick={handleExport}>
          Export CSV
        </Button>
        <Button
          icon={<DeleteOutlined />}
          danger
          disabled={selectedRowKeys.length === 0}
          onClick={() => handleDelete(selectedRowKeys as string[])}
        >
          Delete Selected
        </Button>
      </div>
      <Table
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={filteredFiles}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: true }}
      />
      <Modal
        open={editModal.open}
        title="Edit File"
        onCancel={() => setEditModal({ open: false })}
        onOk={() => editModal.file && handleSaveEdit(editModal.file)}
        okText="Save"
      >
        {editModal.file && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <b>Filename:</b> {editModal.file.filename}
            </div>
            <div>
              <b>User:</b> {editModal.file.user.email}
            </div>
            <div>
              <b>Status:</b>
              <Select
                value={editModal.file.status}
                onChange={status => setEditModal(m => m.file ? { ...m, file: { ...m.file, status } } : m)}
                options={statusOptions.map(s => ({ label: s, value: s }))}
                style={{ width: 120, marginLeft: 8 }}
              />
            </div>
            <div>
              <b>Tags:</b>
              <Select
                mode="tags"
                value={editModal.file.tags}
                onChange={tags => setEditModal(m => m.file ? { ...m, file: { ...m.file, tags } } : m)}
                style={{ width: '100%', marginLeft: 8 }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminFileTable;
