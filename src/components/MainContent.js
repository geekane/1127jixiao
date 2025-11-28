import React, { useState, useEffect, useMemo, useCallback } from 'react';

const API_URL = 'https://1127jixiao.2963781804.workers.dev';

const MainContent = ({ selectedOperator }) => {
    const [kpiTemplate, setKpiTemplate] = useState([]);
    const [performanceData, setPerformanceData] = useState({});
    const [scores, setScores] = useState({});
    const [totalScore, setTotalScore] = useState(0);
    const [processScoreTotal, setProcessScoreTotal] = useState(0);
    const [managementScoreTotal, setManagementScoreTotal] = useState(0);
    const [validationMessages, setValidationMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    const calculateScores = useCallback((template, perfData, operator) => {
        const newScores = {};
        let processTotal = 0;
        let managementTotal = 0;
        const missingFields = [];

        template.forEach(item => {
            if (!item.is_auto_calculated && !perfData[item.editable_field_key]) {
                missingFields.push(`"${item.indicator}" 的 "上月数据"`);
            }

            try {
                let score = 0;
                if (item.category.includes('管理')) {
                    score = parseFloat(perfData[item.editable_field_key]) || 0;
                } else if (item.formula) {
                    const formula = item.formula.toLowerCase();
                    const weight = item.weight;
                    const avg_score = operator?.avg_score || 0;
                    const total_salary = operator?.total_salary || 0;
                    const quit_store_count = parseFloat(perfData?.quit_store_count) || 0;
                    const sales_total = parseFloat(perfData?.sales_total) || 0;
                    
                    score = new Function('weight', 'avg_score', 'total_salary', 'quit_store_count', 'sales_total', `return ${formula}`)(weight, avg_score, total_salary, quit_store_count, sales_total);
                }

                newScores[item.indicator] = score;

                if (item.category.includes('经营') || item.category.includes('过程')) {
                    processTotal += score;
                } else if (item.category.includes('管理')) {
                    managementTotal += score;
                }
            } catch (e) {
                console.error(`计算指标 "${item.indicator}" 的得分时出错:`, e);
                newScores[item.indicator] = 0;
            }
        });
        setScores(newScores);
        setProcessScoreTotal(processTotal);
        setManagementScoreTotal(managementTotal);
        setTotalScore(processTotal + managementTotal);
        setValidationMessages(missingFields);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!selectedOperator) return;
            setLoading(true);
            try {
                const date = new Date();
                const lastMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
                const month = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
                
                const [templateRes, performanceRes] = await Promise.all([
                    fetch(`${API_URL}/kpi-template?person=${selectedOperator.operator_name}`),
                    fetch(`${API_URL}/performance?month=${month}&person=${selectedOperator.operator_name}`)
                ]);

                if (!templateRes.ok) throw new Error('获取考核模板失败');
                if (!performanceRes.ok) throw new Error('获取考核数据失败');

                const templateData = await templateRes.json();
                const perfData = await performanceRes.json();
                
                setKpiTemplate(templateData || []);
                setPerformanceData(perfData || {});
                calculateScores(templateData || [], perfData || {}, selectedOperator);

            } catch (error) {
                console.error(error);
                alert(error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedOperator, calculateScores]);

    const handleDataChange = (key, value) => {
        const newData = { ...performanceData, [key]: value };
        setPerformanceData(newData);
        calculateScores(kpiTemplate, newData, selectedOperator);
    };
    
    const handleSave = async () => {
        if (!selectedOperator) return;
        setLoading(true);
        try {
            const date = new Date();
            const lastMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
            const month = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
            
            const payload = { ...performanceData, performance_month: month, person_name: selectedOperator.operator_name };

            const response = await fetch(`${API_URL}/performance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('保存失败');
            alert('保存成功！');
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const groupedTemplate = useMemo(() => {
        return kpiTemplate.reduce((acc, item) => {
            const category = item.category || '其他';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {});
    }, [kpiTemplate]);

    if (!selectedOperator) {
        return <div className="main-content"><h1>绩效考核表</h1><p>请在左侧选择一位运营人员。</p></div>;
    }
    
    if (loading) {
        return <div className="main-content"><h1>正在加载考核数据...</h1></div>;
    }

    const getLastMonthValue = (item) => {
        if (item.is_auto_calculated) {
            if (item.indicator.includes('经营分')) {
                return `${(selectedOperator.avg_score || 0).toFixed(2)}分`;
            }
            if (item.indicator.includes('核销总目标')) {
                return `${(selectedOperator.total_salary || 0).toFixed(2)}元`;
            }
            return 'N/A';
        }
        return <input 
            type="text" 
            value={performanceData[item.editable_field_key] || ''} 
            onChange={(e) => handleDataChange(item.editable_field_key, e.target.value)}
        />;
    };

    const getRemarksValue = (item) => {
        const remarksKey = item.editable_field_key ? item.editable_field_key.replace('last_month', 'remarks') : null;
        if (!remarksKey) return '';
        return performanceData[remarksKey] || '';
    };

    const handleRemarksChange = (item, value) => {
        const remarksKey = item.editable_field_key ? item.editable_field_key.replace('last_month', 'remarks') : null;
        if(remarksKey) {
            handleDataChange(remarksKey, value);
        }
    };

    return (
        <div className="main-content">
            <div className="main-header">
                <h1>{`${new Date().getFullYear()}年${new Date().getMonth() + 1}月 ${selectedOperator.operator_name} 绩效考核表`}</h1>
                <div className="header-actions">
                    <div className="total-score">
                        总得分: <span>{totalScore.toFixed(2)}</span>
                        <small>(过程: {processScoreTotal.toFixed(2)} + 管理: {managementScoreTotal.toFixed(2)})</small>
                    </div>
                    <button className="save-button" onClick={handleSave} disabled={loading}>
                        {loading ? '保存中...' : '保存更改'}
                    </button>
                </div>
            </div>
            
            {validationMessages.length > 0 && (
                <div className="validation-warning">
                    <p>请填写以下必填项：</p>
                    <ul>
                        {validationMessages.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                </div>
            )}

            {Object.entries(groupedTemplate).map(([category, items]) => (
                 <div className="table-container" key={category}>
                    <h2>{category}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>经营指标</th><th>关键考核指标</th><th>权重</th>
                                <th>上月数据</th><th>得分</th><th>备注</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td>{item.indicator}</td>
                                    <td>{item.kpi}</td>
                                    <td>{item.weight}</td>
                                    <td>{getLastMonthValue(item)}</td>
                                    <td>{(scores[item.indicator] || 0).toFixed(2)}</td>
                                    <td>
                                        <input 
                                            type="text" 
                                            value={getRemarksValue(item)}
                                            onChange={(e) => handleRemarksChange(item, e.target.value)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

export default MainContent;