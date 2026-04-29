export async function generateSQL(userQuery, schemaInfo) {
    try {
        const modelId = "mrm8488/t5-base-finetuned-wikiSQL";
        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;
 
        let formattedSchema;
        if (schemaInfo.includes('uploaded_data')) {
            const match = schemaInfo.match(/Table: uploaded_data, Columns: (.+)/);
            if (match) {
                const columns = match[1].split(', ').join(' , ');
                formattedSchema = `uploaded_data : ${columns}`;
            } else {
                formattedSchema = 'uploaded_data : name , age , city , salary';
            }
        } else {
            formattedSchema = 'products : id , name , category , price , stock_quantity | sales : id , product_id , sale_date , amount';
        }
 
        const input = `${userQuery} | ${formattedSchema}`;
 
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: input, options: { wait_for_model: true } })
        });
 
        if (!response.ok) throw new Error(`HuggingFace API error: ${response.status}`);
 
        const result = await response.json();
 
        if (result && result[0] && result[0].generated_text) {
            const sql = result[0].generated_text.trim();
            // Only use model output if it's specific (not just SELECT *)
            if (sql && !sql.toLowerCase().match(/^select \* from \w+;?$/)) {
                return sql;
            }
        }
 
        throw new Error('Model returned generic result');
 
    } catch (error) {
        console.error('HuggingFace fallback:', error.message);
        return smartFallbackSQL(userQuery, schemaInfo);
    }
}
 
function parseColumns(schemaInfo, tableName) {
    const match = schemaInfo.match(new RegExp(`Table: ${tableName}, Columns: (.+)`));
    if (!match) return [];
    return match[1].split(', ').map(c => c.trim());
}
 
function smartFallbackSQL(userQuery, schemaInfo) {
    const q = userQuery.toLowerCase();
 
    // Determine which table to use
    const hasUploadedData = schemaInfo.includes('uploaded_data');
    const hasSales = schemaInfo.includes('sales');
    const hasProducts = schemaInfo.includes('products');
 
    let table;
    if (hasUploadedData && (q.includes('upload') || q.includes('csv') || !hasProducts)) {
        table = 'uploaded_data';
    } else if (hasSales && (q.includes('sale') || q.includes('revenue') || q.includes('sold') || q.includes('transaction'))) {
        table = 'sales';
    } else {
        table = hasProducts ? 'products' : (hasUploadedData ? 'uploaded_data' : 'products');
    }
 
    const columns = parseColumns(schemaInfo, table);
 
    // COUNT
    if (q.includes('count') || q.includes('how many') || q.includes('total number')) {
        return `SELECT COUNT(*) as count FROM ${table};`;
    }
 
    // AVERAGE
    if (q.match(/average|avg/)) {
        const numCol = columns.find(c => ['price', 'amount', 'salary', 'age', 'cost', 'revenue', 'stock_quantity'].includes(c.toLowerCase()));
        if (numCol) return `SELECT AVG(${numCol}) as average_${numCol} FROM ${table};`;
    }
 
    // SUM
    if (q.includes('total') || q.includes('sum')) {
        const numCol = columns.find(c => ['price', 'amount', 'salary', 'cost', 'revenue'].includes(c.toLowerCase()));
        if (numCol) return `SELECT SUM(${numCol}) as total_${numCol} FROM ${table};`;
    }
 
    // MAX
    if (q.includes('most expensive') || q.includes('highest') || q.includes('maximum') || q.includes('max')) {
        const numCol = columns.find(c => ['price', 'amount', 'salary', 'cost'].includes(c.toLowerCase()));
        if (numCol) return `SELECT * FROM ${table} ORDER BY ${numCol} DESC LIMIT 1;`;
    }
 
    // MIN
    if (q.includes('cheapest') || q.includes('lowest') || q.includes('minimum') || q.includes('min')) {
        const numCol = columns.find(c => ['price', 'amount', 'salary', 'cost'].includes(c.toLowerCase()));
        if (numCol) return `SELECT * FROM ${table} ORDER BY ${numCol} ASC LIMIT 1;`;
    }
 
    // TOP N
    const topMatch = q.match(/top\s+(\d+)/);
    if (topMatch) {
        const n = topMatch[1];
        const numCol = columns.find(c => ['price', 'amount', 'salary', 'cost', 'stock_quantity'].includes(c.toLowerCase()));
        if (numCol) return `SELECT * FROM ${table} ORDER BY ${numCol} DESC LIMIT ${n};`;
        return `SELECT * FROM ${table} LIMIT ${n};`;
    }
 
    // LIMIT N rows
    const limitMatch = q.match(/(\d+)\s*(items?|rows?|records?|results?)/);
    if (limitMatch) {
        return `SELECT * FROM ${table} LIMIT ${limitMatch[1]};`;
    }
 
    // ORDER BY price
    if (q.includes('expensive') || q.includes('price') || q.includes('cost')) {
        const priceCol = columns.find(c => ['price', 'cost', 'amount'].includes(c.toLowerCase()));
        if (priceCol) {
            const dir = (q.includes('cheap') || q.includes('low') || q.includes('asc')) ? 'ASC' : 'DESC';
            return `SELECT * FROM ${table} ORDER BY ${priceCol} ${dir};`;
        }
    }
 
    // ORDER BY date
    if (q.includes('recent') || q.includes('latest') || q.includes('newest') || q.includes('date')) {
        const dateCol = columns.find(c => ['date', 'sale_date', 'created_at', 'updated_at', 'timestamp'].includes(c.toLowerCase()));
        if (dateCol) return `SELECT * FROM ${table} ORDER BY ${dateCol} DESC;`;
    }
 
    // GROUP BY category
    if (q.includes('category') || q.includes('group') || q.includes('by type')) {
        const catCol = columns.find(c => ['category', 'type', 'group', 'department', 'region'].includes(c.toLowerCase()));
        if (catCol) {
            const numCol = columns.find(c => ['price', 'amount', 'salary'].includes(c.toLowerCase()));
            if (numCol) return `SELECT ${catCol}, COUNT(*) as count, AVG(${numCol}) as avg_${numCol} FROM ${table} GROUP BY ${catCol};`;
            return `SELECT ${catCol}, COUNT(*) as count FROM ${table} GROUP BY ${catCol};`;
        }
    }
 
    // DISTINCT
    if (q.includes('distinct') || q.includes('unique') || q.includes('different')) {
        const catCol = columns.find(c => ['category', 'type', 'region', 'department', 'status'].includes(c.toLowerCase()));
        if (catCol) return `SELECT DISTINCT ${catCol} FROM ${table};`;
    }
 
    // WHERE with quoted value
    const quotedMatch = userQuery.match(/"([^"]+)"|'([^']+)'/);
    if (quotedMatch) {
        const val = quotedMatch[1] || quotedMatch[2];
        const textCol = columns.find(c => ['name', 'category', 'type', 'status', 'region', 'department'].includes(c.toLowerCase()));
        if (textCol) return `SELECT * FROM ${table} WHERE ${textCol} = '${val}';`;
    }
 
    // name + price together
    if (q.includes('name') && q.includes('price')) {
        const nameCol = columns.find(c => c.toLowerCase() === 'name');
        const priceCol = columns.find(c => ['price', 'cost', 'amount'].includes(c.toLowerCase()));
        if (nameCol && priceCol) return `SELECT ${nameCol}, ${priceCol} FROM ${table} ORDER BY ${priceCol} DESC;`;
    }
 
    // Default
    return `SELECT * FROM ${table} LIMIT 100;`;
}
 