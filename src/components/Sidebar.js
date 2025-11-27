import React, { useState } from 'react';

const API_URL = 'https://1127jixiao.2963781804.workers.dev/update';

const Sidebar = ({ operators, selectedOperator, onOperatorChange }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    alert('正在后台同步最新数据，请稍候...');
    try {
      const response = await fetch(API_URL, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`同步请求失败: ${response.status}`);
      }
      const result = await response.json();
      alert(`同步成功！\n${result.message}`);
      
      // 清除缓存并刷新页面以加载新数据
      localStorage.removeItem('performanceData');
      window.location.reload();

    } catch (error) {
      alert(`同步失败: ${error.message}`);
    } finally {
      setIsSyncing(false);
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
    </div>
  );
};

export default Sidebar;