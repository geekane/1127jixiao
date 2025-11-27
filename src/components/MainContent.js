import React from 'react';
import Table from './Table';

const MainContent = ({ selectedOperator }) => {
  if (!selectedOperator) {
    return (
      <div className="main-content">
        <h1>2025年11月绩效考核表</h1>
        <p>请在左侧选择一位运营人员以查看绩效数据。</p>
      </div>
    );
  }

  const basicInfo = {
    title: '基本信息',
    columns: [
      { title: '考核部门', key: 'department' },
      { title: '考核人姓名', key: 'name' },
      { title: '考核人职位', key: 'position' },
      { title: '考核人岗位职级', key: 'level' },
      { title: '业绩目标', key: 'goal' },
      { title: '绩效员工确认', key: 'confirmation' },
    ],
    data: [
      {
        department: '客服组',
        name: selectedOperator.operator_name,
        position: '客服',
        level: '',
        goal: '销售业绩1500元',
        confirmation: '',
      },
    ],
  };

  const processIndicators = {
    title: '过程指标',
    columns: [
      { title: '经营指标', key: 'indicator' },
      { title: '关键考核指标', key: 'kpi' },
      { title: '权重', key: 'weight' },
      { title: '指标公式', key: 'formula' },
      { title: '数据来源', key: 'source' },
      { title: '上月数据', key: 'last_month' },
      { title: '得分', key: 'score' },
      { title: '备注', key: 'remarks' },
    ],
    data: [
      {
        indicator: '门店经营分平均大于等于76分以上',
        kpi: '完成指标',
        weight: 30,
        formula: '得分=权重×实际得分÷76×100(达成则单项满分，未达成则按比例计算)',
        source: '抖音后台',
        last_month: `${(selectedOperator.avg_score || 0).toFixed(2)}分`,
        score: '',
        remarks: '',
      },
      {
        indicator: '退出门店数量管控',
        kpi: '小于5家',
        weight: 10,
        formula: '超出一家扣5分',
        source: '抖音后台',
        last_month: '',
        score: '',
        remarks: '',
      },
      {
        indicator: '销售总指标1500元',
        kpi: '完成指标',
        weight: 20,
        formula: '根据完成比例折算，超额完成按系数折算',
        source: '财务数据',
        last_month: '',
        score: '',
        remarks: '',
      },
    ],
  };
  
    const managementIndicators = {
    title: '管理指标',
    columns: [
      { title: '管理指标', key: 'indicator' },
      { title: '关键考核指标', key: 'kpi' },
      { title: '权重', key: 'weight' },
      { title: '指标公式', key: 'formula' },
      { title: '数据来源', key: 'source' },
      { title: '上月数据', key: 'last_month' },
      { title: '得分', key: 'score' },
      { title: '备注', key: 'remarks' },
    ],
    data: [
        {
            indicator: '客服回复消息质量（及时性）',
            kpi: '门店在群里提问后，工作时间内，客服10分钟内回复；工作时间外，客服30分钟内回复；当月无延迟，则单项满分，如违规1次；则扣除5分。',
            weight: 20,
            formula: '当月无延迟，则单项满分，如违规1次；则扣除5分。',
            source: '上级反馈',
            last_month: '',
            score: '',
            remarks: '',
        },
        {
            indicator: '零停业门店达成率',
            kpi: '保证无因违规导致停业门店',
            weight: 5,
            formula: '出现1家，单项0分',
            source: '抖音后台',
            last_month: '',
            score: '',
            remarks: '',
        },
        {
            indicator: '抖音后台操作规范性（及时性/准确性）',
            kpi: '1、装修“抖音来客”后台，按时处理完毕（2小时内）；\n2、操作“抖音来客”后台，不得出现错误操作，无论是否导致客户投诉；',
            weight: 10,
            formula: '当月操作无延迟/无差错，则单项满分；如违规1次，则扣除5分。',
            source: '后台数据、员工反馈',
            last_month: '',
            score: '',
            remarks: '',
        },
        {
            indicator: '跨部门协作时效达成率',
            kpi: '按时按期完成协作任务；协作任务包括：直播排期（提前15天）、达人全流程（7天）、经营问题反馈（48小时）等',
            weight: 5,
            formula: '1、按期完成的协作任务数 ÷ 发起的协作任务总数 × 100%；\n2、跨部门协作时效达成率≥95%，则单项满分；否则，每低0.1%，扣除1分；',
            source: '分管上级',
            last_month: '',
            score: '',
            remarks: '',
        },
    ],
  };
  
  const egpInfo = {
    title: 'EGP（Employee Growth Plan - 分管领导的主观评分）',
    columns: [
        { title: '考核目标', key: 'target' },
        { title: '指标公式', key: 'formula' },
        { title: '数据来源', key: 'source' },
        { title: '得分', key: 'score' },
        { title: '备注', key: 'remarks' },
    ],
    data: [
        {
            target: '分管领导对态度、能力项、合作精神等对员工进行主观评价，包含但不限于以下维度\n1、带人能力\n2、行业认知\n3、跨部门协调能力',
            formula: 'EGP系数 1.2、1、0.8、0\n系数非1时，需举证',
            source: '分管领导',
            score: '',
            remarks: '',
        },
    ],
  };

  const resultInfo = {
    title: '考核结果',
    columns: [
        { title: '考核得分', key: 'score' },
        { title: '员工本人签字', key: 'employee_signature' },
        { title: '部门负责人签字', key: 'manager_signature' },
        { title: '财务部签字', key: 'finance_signature' },
        { title: 'CEO签字', key: 'ceo_signature' },
    ],
    data: [
        {
            score: '',
            employee_signature: '',
            manager_signature: '',
            finance_signature: '',
            ceo_signature: '',
        },
    ],
  };

  return (
    <div className="main-content">
      <h1>2025年11月绩效考核表</h1>
      <Table title={basicInfo.title} columns={basicInfo.columns} data={basicInfo.data} />
      <Table title={processIndicators.title} columns={processIndicators.columns} data={processIndicators.data} />
      <Table title={managementIndicators.title} columns={managementIndicators.columns} data={managementIndicators.data} />
      <Table title={egpInfo.title} columns={egpInfo.columns} data={egpInfo.data} />
      <Table title={resultInfo.title} columns={resultInfo.columns} data={resultInfo.data} />

      <div className="info-section">
        <h2>绩效计算说明</h2>
        <pre>
          **备注：**
          - 月度奖金基数 = 月标准工资 × 20%
          - 月度绩效结果 = KR加权达成率 × EGP系数
          - 月度奖金 = 月度奖金基数 × 财务经营系数 × 绩效系数

          **绩效总分对应绩效系数：**
          - 绩效总分在80分：绩效100%
          - 绩效总分在70-80分（不含80分）：绩效80%
          - 绩效总分在60-70分（不含70分）：绩效60%
          - 绩效总分低于60分（含60分）：绩效0%
        </pre>
      </div>

      <div className="warning-section">
        <h2>淘汰机制</h2>
        <p>
          公司2025年实行全员能上能下的用人原则，若员工连续2个月个人业绩指标完成度在70%以下，由员工提出改善计划，公司有权启动淘汰机制或末尾淘汰，如有特殊情况，公司可安排留岗观察或转岗。
        </p>
        <p>
          新入职的同学原则上入职后参加考核，若员工在15日之后入职，则从次月开始参加绩效考核。
        </p>
      </div>
    </div>
  );
};

export default MainContent;