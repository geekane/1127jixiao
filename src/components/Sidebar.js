import React, { useState, useRef } from 'react';

const API_URL = 'https://1127jixiao.2963781804.workers.dev';

const Sidebar = ({ operators, selectedOperator, onOperatorChange }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSync = async () => {
    setIsSyncing(true);
    alert('正在后台同步最新数据，请稍候...');
    try {
      const response = await fetch(`${API_URL}/update`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`同步请求失败: ${response.status}`);
      }
      const result = await response.json();
      alert(`同步成功！\n${result.message}`);
      
      localStorage.removeItem('performanceData');
      window.location.reload();

    } catch (error) {
      alert(`同步失败: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('请先选择一个文件！');
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/update-groups`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      const result = await response.json();
      alert(`分组更新成功！\n${result.message}`);
    } catch (error) {
      alert(`上传失败: ${error.message}`);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="sidebar">
      <h2>数据管理</h2>
      <div className="sidebar-section">
        <label htmlFor="operator-select">选择运营成员:</label>
        <select
          id="operator-select"
          value={selectedOperator ? selectedOperator.operator_name : ''}
          onChange={(e) => onOperatorChange(e.target.value)}
        >
          {operators.map((op) => (
            <option key={op.operator_name} value={op.operator_name}>
              {op.operator_name}
            </option>
          ))}
        </select>
      </div>

      {selectedOperator && (
        <div className="sidebar-section">
          <p><strong>选中人员:</strong> {selectedOperator.operator_name}</p>
          <p><strong>负责分组:</strong> {selectedOperator.group_name}</p>
          <p><strong>门店数量:</strong> {selectedOperator.store_count}家</p>
          <p><strong>平均经营分:</strong> {(selectedOperator.avg_score || 0).toFixed(2)}分</p>
          <p><strong>总核销金额:</strong> {(selectedOperator.total_salary || 0).toFixed(2)}元</p>
        </div>
      )}

      <div className="sidebar-section">
        <h3>数据采集</h3>
        <button className="sync-button" onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? '同步中...' : '立刻同步'}
        </button>
      </div>

      <div className="sidebar-section">
        <h3>分组管理</h3>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".xlsx, .xls"
        />
        <button className="upload-button" onClick={handleUploadClick} disabled={isUploading}>
          选择文件
        </button>
        {selectedFile && <span className="file-name">{selectedFile.name}</span>}
        <button className="sync-button" onClick={handleUpload} disabled={isUploading || !selectedFile} style={{marginTop: '10px'}}>
          {isUploading ? '上传中...' : '上传分组'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;