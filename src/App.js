import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';

const API_URL = 'https://1127jixiao.2963781804.workers.dev/';

function App() {
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      // 1. 尝试从LocalStorage获取缓存
      const cachedData = localStorage.getItem('performanceData');
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          setOperators(parsedData.data);
          if (parsedData.data.length > 0) {
            setSelectedOperator(parsedData.data[0]);
          }
          console.log("从缓存加载数据成功。");
          setLoading(false);
          return; // 使用缓存数据后，本次不再请求网络
        } catch (e) {
          console.error("解析缓存数据失败:", e);
          localStorage.removeItem('performanceData'); // 如果缓存无效则移除
        }
      }

      // 2. 如果没有缓存，则从网络获取
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        setOperators(data.data);
        if (data.data.length > 0) {
          setSelectedOperator(data.data[0]);
        }
        
        // 3. 将新数据存入LocalStorage
        localStorage.setItem('performanceData', JSON.stringify(data));
        console.log("从API获取数据并缓存成功。");

      } catch (err) {
        setError(err.message);
        console.error("获取数据失败:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleOperatorChange = (operatorName) => {
    const operator = operators.find(op => op.operator_name === operatorName);
    setSelectedOperator(operator);
  };
  
  // 渲染逻辑
  if (loading) {
    return <div className="app-container"><h1>加载中...</h1></div>;
  }

  if (error) {
    return <div className="app-container"><h1>错误: {error}</h1></div>;
  }

  return (
    <div className="app-container">
      <Sidebar
        operators={operators}
        selectedOperator={selectedOperator}
        onOperatorChange={handleOperatorChange}
      />
      <MainContent selectedOperator={selectedOperator} />
    </div>
  );
}

export default App;
