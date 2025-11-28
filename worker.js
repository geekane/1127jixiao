import { Router } from 'itty-router';
import * as XLSX from 'xlsx';

const router = Router();

// CORS 预检请求处理
router.options('*', () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

function getLastMonthDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastMonth = month === 0 ? 11 : month - 1;
  const lastMonthYear = month === 0 ? year - 1 : year;
  const startDate = new Date(lastMonthYear, lastMonth, 1);
  const endDate = new Date(year, month, 0);
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}

async function checkDataFreshness(env) {
    const lastMonth = getLastMonthDateRange();
    const expectedEndDate = lastMonth.end;
    const stmt = env.DB.prepare('SELECT MAX(data_date_range) AS latest_date FROM douyindata');
    try {
        const result = await stmt.first();
        return result && result.latest_date === expectedEndDate;
    } catch (e) {
        console.error("检查数据新鲜度失败:", e);
        return false;
    }
}

// [GET /] - 动态获取运营人员列表及聚合数据
router.get('/', async (request, env) => {
    const { query, url } = request;
    let { start_date: startDate, end_date: endDate } = query;
    let source = 'request';
    let update_triggered = false;

    if (!startDate || !endDate) {
      const lastMonth = getLastMonthDateRange();
      startDate = lastMonth.start;
      endDate = lastMonth.end;
      source = 'auto_last_month';
    }

    try {
      const isFresh = await checkDataFreshness(env);
      if (!isFresh && source === 'auto_last_month') {
        console.log("数据已陈旧，正在触发后台更新...");
        const updateUrl = new URL(url);
        updateUrl.pathname = '/update';
        request.ctx.waitUntil(fetch(updateUrl.toString(), { method: 'POST' }));
        update_triggered = true;
      }
      
      const operatorsQuery = `SELECT DISTINCT person, group_number FROM group_status`;
      const dateRangeString = `${startDate}~${endDate}`;
      const amountsQuery = `
          SELECT gs.person, SUM(dm.verify_amount) AS total_salary, COUNT(gs.store_id) AS store_count
          FROM douyinmonthdata dm JOIN group_status gs ON dm.store_id = gs.store_id
          WHERE dm.data_date_range = ?1 GROUP BY gs.person;`;
      const scoresQuery = `
          SELECT gs.person, AVG(dd.store_operation_score) AS avg_score
          FROM douyindata dd JOIN group_status gs ON dd.store_id = gs.store_id
          WHERE dd.data_date_range = ?1 GROUP BY gs.person;`;

      const [operatorsResult, amountsResult, scoresResult] = await env.DB.batch([
          env.DB.prepare(operatorsQuery),
          env.DB.prepare(amountsQuery).bind(dateRangeString),
          env.DB.prepare(scoresQuery).bind(endDate)
      ]);

      const aggregatedData = {};
      if (operatorsResult.success) {
          operatorsResult.results.forEach(op => {
              aggregatedData[op.person] = {
                  operator_name: op.person,
                  group_name: op.group_number,
                  store_count: 0,
                  avg_score: 0,
                  total_salary: 0,
              };
          });
      }
      if (amountsResult.success) {
          amountsResult.results.forEach(row => {
              if (aggregatedData[row.person]) {
                  aggregatedData[row.person].total_salary = row.total_salary;
                  aggregatedData[row.person].store_count = row.store_count;
              }
          });
      }
      if (scoresResult.success) {
          scoresResult.results.forEach(row => {
              if (aggregatedData[row.person]) {
                  aggregatedData[row.person].avg_score = row.avg_score;
              }
          });
      }
      
      const finalResult = Object.values(aggregatedData);
      const responsePayload = {
        data_date_range: { start: startDate, end: endDate, source: source },
        update_triggered: update_triggered,
        data: finalResult,
      };
      
      return new Response(JSON.stringify(responsePayload, null, 2), { headers: corsHeaders });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});

// [GET /kpi-template] - 根据人员姓名直接获取其考核模板
router.get('/kpi-template', async (request, env) => {
    const { query } = request;
    const person = query.person;

    if (!person) {
        return new Response(JSON.stringify({ error: '请提供 "person" 参数。' }), { status: 400, headers: corsHeaders });
    }

    try {
        const templatesResult = await env.DB.prepare(
            'SELECT * FROM kpi_templates WHERE person_name = ?1'
        ).bind(person).all();

        if (!templatesResult.success) {
            throw new Error('查询KPI模板失败: ' + templatesResult.error);
        }

        if (templatesResult.results.length === 0) {
            console.log(`未找到人员 ${person} 的KPI模板。将返回空数组。`);
            return new Response(JSON.stringify([]), { headers: corsHeaders });
        }

        return new Response(JSON.stringify(templatesResult.results), { headers: corsHeaders });
    } catch (e) {
        console.error("获取KPI模板失败:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});

// [GET /performance] - 获取或创建指定人员和月份的考核数据
router.get('/performance', async (request, env) => {
    const { query } = request;
    const month = query.month;
    const person = query.person;

    if (!month || !person) {
        return new Response(JSON.stringify({ error: '请提供 "month" 和 "person" 参数。' }), { status: 400, headers: corsHeaders });
    }

    try {
        let performanceData = await env.DB.prepare(
            'SELECT * FROM monthly_performance WHERE performance_month = ?1 AND person_name = ?2'
        ).bind(month, person).first();

        if (!performanceData) {
            console.log(`未找到 ${person} 在 ${month} 的考核记录，正在创建...`);
            const insertStmt = env.DB.prepare(
                'INSERT INTO monthly_performance (performance_month, person_name, department) VALUES (?1, ?2, ?3)'
            ).bind(month, person, '客服组');
            await insertStmt.run();
            
            performanceData = await env.DB.prepare(
                'SELECT * FROM monthly_performance WHERE performance_month = ?1 AND person_name = ?2'
            ).bind(month, person).first();
        }

        return new Response(JSON.stringify(performanceData), { headers: corsHeaders });
    } catch (e) {
        console.error("获取或创建考核数据失败:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});

// [POST /performance] - 更新指定人员和月份的考核数据
router.post('/performance', async (request, env) => {
    try {
        const body = await request.json();
        const { performance_month, person_name, ...fieldsToUpdate } = body;

        if (!performance_month || !person_name) {
            return new Response(JSON.stringify({ error: '请求体中必须包含 "performance_month" 和 "person_name"。' }), { status: 400, headers: corsHeaders });
        }
        
        const allowedFields = ['quit_store_count', 'sales_total', 'manage_last_month_1', 'manage_remarks_1', 'manage_last_month_2', 'manage_remarks_2', 'manage_last_month_3', 'manage_remarks_3', 'manage_last_month_4', 'manage_remarks_4', 'manage_last_month_5', 'manage_remarks_5', 'egp_score', 'egp_remarks', 'final_score', 'employee_signature', 'manager_signature', 'finance_signature', 'ceo_signature'];
        const fields = Object.keys(fieldsToUpdate).filter(key => allowedFields.includes(key) && fieldsToUpdate[key] !== null);
        
        if (fields.length === 0) {
             return new Response(JSON.stringify({ message: '没有需要更新的字段。' }), { headers: corsHeaders });
        }

        const setClauses = fields.map(key => `${key} = ?`).join(', ');
        const values = fields.map(key => fieldsToUpdate[key]);

        const stmt = env.DB.prepare(
            `UPDATE monthly_performance SET ${setClauses} WHERE performance_month = ? AND person_name = ?`
        ).bind(...values, performance_month, person_name);

        const result = await stmt.run();

        if (result.meta.changes > 0) {
            return new Response(JSON.stringify({ message: '考核数据更新成功。' }), { headers: corsHeaders });
        } else {
            const allFields = ['performance_month', 'person_name', 'department', ...fields];
            const allValues = [performance_month, person_name, '客服组', ...values];
            const placeholders = allFields.map(()=>'?').join(',');
            
            const insertStmt = env.DB.prepare(
                `INSERT INTO monthly_performance (${allFields.join(', ')}) VALUES (${placeholders})`
            );
            await insertStmt.bind(...allValues).run();
            return new Response(JSON.stringify({ message: '考核数据创建成功。' }), { status: 201, headers: corsHeaders });
        }
    } catch (e) {
        console.error("更新考核数据失败:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});


async function extractDataFromAPI(startDate, endDate) {
    console.log(`--- LOG: 开始下载周数据 (${startDate} to ${endDate})...`);
    const apiUrl = 'https://www.life-data.cn/api/dito/query';
    const headers = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'cookie': 'passport_csrf_token=86dc5731da9047f4e92be57f55951317; passport_csrf_token_default=86dc5731da9047f4e92be57f55951317; is_staff_user=false; sid_guard=cdeed2a82c0c946ac3639cb94a137341%7C1761719939%7C5012576%7CFri%2C+26-Dec-2025+07%3A01%3A55+GMT; uid_tt=b28e76efc6fbcfc77440b989e9511d65; uid_tt_ss=b28e76efc6fbcfc77440b989e9511d65; sid_tt=cdeed2a82c0c946ac3639cb94a137341; sessionid=cdeed2a82c0c946ac3639cb94a137341; sessionid_ss=cdeed2a82c0c946ac3639cb94a137341; session_tlb_tag=sttt%7C5%7Cze7SqCwMlGrDY5y5ShNzQf________-sz6tFDOQ2k8HIpCnXO1msPRYK0G2iEZN8xOK9ASBGKiM%3D; sid_ucp_v1=1.0.0-KGU3YzQ5NzgzOGYwNDk5YTA1MDlkMjMyNzc4YWZmOWQ1Yzk5OTMxOWYKGAj-xLC9_cykAhCD7YbIBhjMrB04AUDrBxoCaGwiIGNkZWVkMmE4MmMwYzk0NmFjMzYzOWNiOTRhMTM3MzQx; ssid_ucp_v1=1.0.0-KGU3YzQ5NzgzOGYwNDk5YTA1MDlkMjMyNzc4YWZmOWQ1Yzk5OTMxOWYKGAj-xLC9_cykAhCD7YbIBhjMrB04AUDrBxoCaGwiIGNkZWVkMmE4MmMwYzk0NmFjMzYzOWNiOTRhMTM3MzQx; csrf_session_id=8c5e5b4ef482b024d75764477243fe85; gd_random=eyJtYXRjaCI6dHJ1ZSwicGVyY2VudCI6MC43MzkzNDMyMTU3MTYwNjg0fQ==.eOduivmuTmhYGoUg31jlCi02FuQ4WtFtJW71nnCYlJk=',
        'life-account-id': '7241078611527075855',
        'origin': 'https://www.life-data.cn',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://www.life-data.cn/store/my/chain/poi/overview?groupid=1768205901316096',
        'related-account-id': '0',
        'root-life-account-id': '7241078611527075855',
        'sec-ch-ua': '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
        'x-secsdk-csrf-token': '00010000000196abe940802a1054792d8960210611edc788c509574afb23bc5141c9d52b08a01877834669b4b3be',
        'x-tt-ls-session-id': 'a073b46d-a358-4c97-b8aa-359fd5b2a720',
        'x-tt-trace-id': '00-7c4f78ce18dfba45305d491cb-7c4f78ce18dfba45-01',
        'x-tt-trace-log': '01',
    };
    const payload = {
        "biz_params": {
            "path": "/store/my/chain/poi/overview", "first_render": false,
            "common_params": { "end_date": endDate, "date_type": "custom", "start_date": startDate },
            "module_params": {
                "AllPoiList": {
                    "poi_id": [], "brand_id": [], "poi_type": [], "poi_sizer": {},
                    "indicators": ["enter_poi_uv_cnt", "visit_deal_uv_convert_rate", "pay_intention_gmv_1d", "verify_amount_1d", "verify_user_cnt_1d", "verify_cert_cnt_1d", "verify_new_user_cnt_1d", "verify_old_user_cnt_1d", "poi_score", "manage_score", "positive_rate_cnt_1d", "normal_negative_rate", "consumption_rate_cnt_1d", "enter_poi_avg_cnt", "click_poi_project_card_cnt_1d", "click_poi_project_card_uv_cnt_1d", "pay_user_cnt_1d", "pay_cert_cnt_1d", "visit_deal_convert_rate", "enter_poi_cnt", "video_cnt_1d", "video_play_cnt_1d", "convert_label", "pay_gmv", "refund_amount", "refund_cert_cnt", "refund_user_cnt", "new_rate_cnt_1d", "reply_rate_ratio", "bad_comment_ratio", "cs_ticket_ratio", "account_refund_order_ratio", "visible_checkin_cnt_1d", "visible_checkin_item_cnt_1d", "favorite_cnt_1d", "pay_intention_cert_cnt_1d", "pay_intention_user_cnt_1d", "refund_intention_gmv", "refund_intention_cert_cnt", "refund_intention_user_cnt", "rank_text"],
                    "download": 1
                }
            }
        }
    };
    console.log("步骤1/3: 正在请求创建导出任务...");
    const initialResponse = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!initialResponse.ok) throw new Error(`API初始请求失败: ${initialResponse.status} ${initialResponse.statusText}`);
    const initialData = await initialResponse.json();
    const taskId = initialData?.data?.[0]?.task_id;
    if (!taskId) throw new Error(`解析失败！未能从初始响应中找到 'task_id'。响应: ${JSON.stringify(initialData)}`);
    console.log(`成功创建导出任务，任务ID: ${taskId}`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("步骤2/3: 等待5秒后，使用任务ID获取下载链接...");
    const secondPayload = JSON.parse(JSON.stringify(payload));
    secondPayload.biz_params.module_params.AllPoiList.task_id = taskId;
    const finalResponse = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(secondPayload) });
    if (!finalResponse.ok) throw new Error(`API最终请求失败: ${finalResponse.status} ${finalResponse.statusText}`);
    const finalData = await finalResponse.json();
    const downloadUrl = finalData?.data?.[0]?.url;
    if (!downloadUrl) throw new Error(`解析失败！未能从最终响应中找到下载链接 'url'。响应: ${JSON.stringify(finalData)}`);
    console.log(`成功提取下载链接: ${downloadUrl}`);
    console.log("步骤3/3: 正在下载Excel文件...");
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) throw new Error(`文件下载失败: ${downloadResponse.status} ${downloadResponse.statusText}`);
    console.log("下载完成！");
    return downloadResponse.arrayBuffer();
}

const fieldMapping = {
    '数据日期范围': 'data_date_range', '门店名称': 'store_name', '门店ID': 'store_id', '所在区域': 'area',
    '所在省份': 'province', '所在城市': 'city', '所在行政区': 'district', '门店页访问人数': 'page_visit_users',
    '人均访问次数': 'avg_visit_times', '货架商品点击次数': 'shelf_item_click_times', '货架商品点击人数': 'shelf_item_click_users',
    '门店页成交人数': 'page_deal_users', '门店页成交金额': 'page_deal_amount', '门店页成交后退款金额': 'refund_amount',
    '门店页成交后退款券数': 'refund_coupon_count', '门店页成交后退款人数': 'refund_users', '门店页成交券数': 'deal_coupon_count',
    '访问-成交次数转化率': 'visit_to_deal_times_rate', '访问-成交人数转化率': 'visit_to_deal_users_rate',
    '门店页访问次数': 'page_visit_times', '门店关联视频数': 'related_video_count', '门店关联视频播放次数': 'related_video_play_times',
    '门店页转化标签': 'conversion_tag', '门店意向成交金额': 'intent_deal_amount', '门店意向成交券数': 'intent_deal_coupon_count',
    '门店意向成交人数': 'intent_deal_users', '门店核销金额': 'verify_amount', '门店核销人数': 'verify_users',
    '门店核销券数': 'verify_coupon_count', '门店核销新客数': 'verify_new_users', '门店核销老客数': 'verify_old_users',
    '门店意向退款金额': 'intent_refund_amount', '门店意向退款券数': 'intent_refund_coupon_count', '门店意向退款人数': 'intent_refund_users',
    '门店评分': 'store_score', '门店经营分': 'store_operation_score', '新增评价数': 'new_review_count',
    '新增好评数': 'new_good_review_count', '新增中差评数': 'new_bad_review_count', '消费后评价数': 'review_after_consume_count',
    '评价回复率': 'review_reply_rate', '经营风险差评率': 'risk_bad_review_rate', '经营风险投诉率': 'risk_complaint_rate',
    '经营风险商责退单率': 'risk_merchant_fault_order_rate', '门店点亮数': 'store_light_count', '点亮后的投稿数': 'light_after_post_count',
    '门店收藏数': 'store_favorite_count', '上榜榜单及排名': 'ranking_info'
};

function transformData(excelBuffer) {
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    return jsonData.map(row => {
        const newRow = {};
        for (const key in row) {
            if (fieldMapping[key]) {
                newRow[fieldMapping[key]] = row[key];
            }
        }
        return newRow;
    });
}

async function loadMonthDataIntoD1(env, data) {
    const monthDataStmts = [];
    const monthDataInsert = env.DB.prepare(
        `INSERT INTO douyinmonthdata (data_date_range, store_id, store_name, verify_amount) VALUES (?, ?, ?, ?)`
    );
    data.forEach(row => {
        if (row.verify_amount !== undefined) {
            monthDataStmts.push(monthDataInsert.bind(row.data_date_range, row.store_id, row.store_name, row.verify_amount));
        }
    });
    if (monthDataStmts.length > 0) {
        await env.DB.batch(monthDataStmts);
        console.log(`成功向 douyinmonthdata 加载了 ${monthDataStmts.length} 条记录。`);
        return monthDataStmts.length;
    }
    console.log("没有需要加载到 douyinmonthdata 的数据。");
    return 0;
}

async function loadDailyScoreDataIntoD1(env, data, dateForData) {
    const dailyDataStmts = [];
    const dailyDataInsert = env.DB.prepare(
        `INSERT INTO douyindata (data_date_range, store_id, store_name, store_operation_score) VALUES (?, ?, ?, ?)`
    );

    data.forEach(row => {
        if (row.store_operation_score !== undefined) {
            dailyDataStmts.push(dailyDataInsert.bind(dateForData, row.store_id, row.store_name, row.store_operation_score));
        }
    });
    if (dailyDataStmts.length > 0) {
        await env.DB.batch(dailyDataStmts);
        console.log(`成功向 douyindata 加载了 ${dailyDataStmts.length} 条记录。`);
        return dailyDataStmts.length;
    }
    console.log("没有需要加载到 douyindata 的数据。");
    return 0;
}

router.post('/update', async (request, env) => {
    try {
        const lastMonth = getLastMonthDateRange();
        
        console.log(`清空并处理月度数据: ${lastMonth.start} to ${lastMonth.end}`);
        await env.DB.prepare('DELETE FROM douyinmonthdata').run();
        const monthExcelBuffer = await extractDataFromAPI(lastMonth.start, lastMonth.end);
        const transformedMonthData = transformData(monthExcelBuffer);
        const monthlyRecordsLoaded = await loadMonthDataIntoD1(env, transformedMonthData);

        console.log(`清空并处理月底快照数据: ${lastMonth.end}`);
        await env.DB.prepare('DELETE FROM douyindata').run();
        const dailyExcelBuffer = await extractDataFromAPI(lastMonth.end, lastMonth.end);
        const transformedDailyData = transformData(dailyExcelBuffer);
        const dailyRecordsLoaded = await loadDailyScoreDataIntoD1(env, transformedDailyData, lastMonth.end);

        return new Response(JSON.stringify({ 
            message: "ETL流程成功完成。所有旧数据已清除。",
            monthly_records_loaded: monthlyRecordsLoaded,
            daily_records_loaded: dailyRecordsLoaded
        }), { headers: corsHeaders });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});

router.post('/update-groups', async (request, env) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return new Response(JSON.stringify({ error: '未找到上传的文件。' }), { status: 400, headers: corsHeaders });
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const recordsToInsert = [];
        jsonData.forEach(row => {
            const persons = (row['人员'] || '').toString().split(/[,、，]/);
            persons.forEach(person => {
                const trimmedPerson = person.trim();
                if (trimmedPerson) {
                    recordsToInsert.push({
                        group_number: row['小组'],
                        store_name: row['门店名称'],
                        store_id: row['门店id'],
                        person: trimmedPerson,
                    });
                }
            });
        });

        if (recordsToInsert.length === 0) {
            return new Response(JSON.stringify({ message: '在上传的文件中没有找到有效数据。' }), { headers: corsHeaders });
        }

        await env.DB.prepare('DELETE FROM group_status').run();
        
        const stmt = env.DB.prepare(
            'INSERT INTO group_status (group_number, store_name, store_id, person) VALUES (?, ?, ?, ?)'
        );
        const batch = recordsToInsert.map(rec => 
            stmt.bind(rec.group_number, rec.store_name, rec.store_id, rec.person)
        );
        
        await env.DB.batch(batch);

        return new Response(JSON.stringify({ message: `成功更新分组信息，共处理了 ${recordsToInsert.length} 条记录。` }), { headers: corsHeaders });

    } catch (e) {
        console.error("分组更新失败:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
});

router.all('*', () => new Response('404, Not Found!', { 
    status: 404,
    headers: corsHeaders
}));

export default {
  fetch(request, env, ctx) {
    request.env = env;
    request.ctx = ctx;
    return router.handle(request, env, ctx);
  },
};