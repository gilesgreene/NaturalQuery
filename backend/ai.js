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
 
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: input, options: { wait_for_model: true } }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
 
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
    if (hasUploadedData) {
        table = 'uploaded_data';
    } else if (hasSales && (q.includes('sale') || q.includes('revenue') || q.includes('sold') || q.includes('transaction'))) {
        table = 'sales';
    } else {
        table = hasProducts ? 'products' : 'sales';
    }
 
    const columns = parseColumns(schemaInfo, table);
    
    // Sort columns by length descending so we match longer names first ("Total Revenue" before "Revenue")
    const sortedColumns = [...columns].sort((a, b) => b.length - a.length);

    // Find any column explicitly mentioned in the query
    const mentioned = sortedColumns.filter(c => q.includes(c.toLowerCase()) || q.includes(c.toLowerCase().replace(/_/g, ' ')));

    // Try to guess numeric vs category columns
    const possibleNumeric = columns.filter(c => c.toLowerCase().match(/price|cost|amount|salary|total|count|qty|quantity|number|num|age|population|value|score|rate|percent|fee|tax|margin/));
    const targetNumeric = mentioned.find(c => possibleNumeric.includes(c)) || possibleNumeric[0] || columns[columns.length - 1];

    const possibleCategory = columns.filter(c => c.toLowerCase().match(/name|category|type|status|city|country|state|region|group|class|department|brand|make|model|color/));
    const targetCategory = mentioned.find(c => possibleCategory.includes(c)) || possibleCategory[0] || columns[0];

    // COUNT
    if (q.includes('count') || q.includes('how many') || q.includes('total number')) {
        if (targetCategory && q.includes('by')) {
            return `SELECT "${targetCategory}", COUNT(*) as count FROM "${table}" GROUP BY "${targetCategory}" ORDER BY count DESC LIMIT 50;`;
        }
        return `SELECT COUNT(*) as count FROM "${table}";`;
    }
 
    // AVERAGE
    if (q.match(/average|avg/)) {
        if (targetNumeric) {
            if (targetCategory && q.includes('by')) {
                return `SELECT "${targetCategory}", AVG(CAST("${targetNumeric}" AS NUMERIC)) as average FROM "${table}" GROUP BY "${targetCategory}" ORDER BY average DESC LIMIT 50;`;
            }
            return `SELECT AVG(CAST("${targetNumeric}" AS NUMERIC)) as average FROM "${table}";`;
        }
    }
 
    // SUM
    if (q.includes('total') || q.includes('sum')) {
        if (targetNumeric) {
            if (targetCategory && q.includes('by')) {
                return `SELECT "${targetCategory}", SUM(CAST("${targetNumeric}" AS NUMERIC)) as total FROM "${table}" GROUP BY "${targetCategory}" ORDER BY total DESC LIMIT 50;`;
            }
            return `SELECT SUM(CAST("${targetNumeric}" AS NUMERIC)) as total FROM "${table}";`;
        }
    }
 
    // MAX / TOP N
    if (q.includes('most') || q.includes('highest') || q.includes('maximum') || q.includes('max') || q.includes('top')) {
        const nMatch = q.match(/top\s+(\d+)/);
        const limit = nMatch ? nMatch[1] : 10;
        if (targetNumeric) {
            return `SELECT * FROM "${table}" ORDER BY CAST("${targetNumeric}" AS NUMERIC) DESC NULLS LAST LIMIT ${limit};`;
        }
    }
 
    // MIN / BOTTOM N
    if (q.includes('cheapest') || q.includes('least') || q.includes('lowest') || q.includes('minimum') || q.includes('min') || q.includes('bottom')) {
        const nMatch = q.match(/bottom\s+(\d+)/);
        const limit = nMatch ? nMatch[1] : 10;
        if (targetNumeric) {
            return `SELECT * FROM "${table}" ORDER BY CAST("${targetNumeric}" AS NUMERIC) ASC NULLS LAST LIMIT ${limit};`;
        }
    }
 
    // GROUP BY / BY TYPE
    if (q.includes('by ') || q.includes('group')) {
        if (targetCategory) {
            return `SELECT "${targetCategory}", COUNT(*) as count FROM "${table}" GROUP BY "${targetCategory}" ORDER BY count DESC LIMIT 50;`;
        }
    }
    
    // EXACT MATCH WHERE CLAUSE
    const quotedMatch = userQuery.match(/"([^"]+)"|'([^']+)'/);
    if (quotedMatch && targetCategory) {
        const val = quotedMatch[1] || quotedMatch[2];
        return `SELECT * FROM "${table}" WHERE "${targetCategory}" = '${val}' LIMIT 50;`;
    }

    // Default Fallback
    return `SELECT * FROM "${table}" LIMIT 100;`;
}
 