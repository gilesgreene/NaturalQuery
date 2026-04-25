export async function generateSQL(userQuery, schemaInfo) {
    try {
        // Use Hugging Face free inference API with a text-to-SQL model
        const modelId = "mrm8488/t5-base-finetuned-wikiSQL";
        const apiUrl = `https://api-inference.huggingface.co/models/${modelId}`;

        // Format the input for the model
        // WikiSQL format: "question | table : col1 , col2 , col3"
        let formattedSchema;
        if (schemaInfo.includes('uploaded_data')) {
            // Extract columns from uploaded_data
            const match = schemaInfo.match(/Table: uploaded_data, Columns: (.+)/);
            if (match) {
                const columns = match[1].split(', ').join(' , ');
                formattedSchema = `uploaded_data : ${columns}`;
            } else {
                formattedSchema = 'uploaded_data : name , age , city , salary';
            }
        } else {
            // Default tables
            formattedSchema = 'products : id , name , category , price , stock_quantity | sales : id , product_id , sale_date , amount';
        }
        
        const input = `${userQuery} | ${formattedSchema}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: input,
                options: { wait_for_model: true }
            })
        });

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status}`);
        }

        const result = await response.json();

        // The response is an array with generated_text
        if (result && result[0] && result[0].generated_text) {
            return result[0].generated_text.trim();
        } else {
            throw new Error('Unexpected API response');
        }
    } catch (error) {
        console.error('Hugging Face API error:', error);
        // Fallback to keyword-based generation
        return fallbackSQLGeneration(userQuery, schemaInfo);
    }
}

function fallbackSQLGeneration(userQuery, schemaInfo) {
    // Check if uploaded_data table exists
    if (schemaInfo.includes('uploaded_data')) {
        // Simple keyword-based for uploaded data
        const query = userQuery.toLowerCase();
        if (query.includes('all') || query.includes('show')) {
            return "SELECT * FROM uploaded_data;";
        } else if (query.includes('count')) {
            return "SELECT COUNT(*) as count FROM uploaded_data;";
        } else {
            return "SELECT * FROM uploaded_data LIMIT 10;";
        }
    } else {
        // Original logic for default tables
        const query = userQuery.toLowerCase();
        
        if (query.includes('product') || query.includes('all')) {
            return "SELECT * FROM products;";
        } else if (query.includes('sale')) {
            return "SELECT * FROM sales;";
        } else if (query.includes('category')) {
            return "SELECT DISTINCT category FROM products;";
        } else if (query.includes('price') || query.includes('expensive')) {
            return "SELECT name, price FROM products ORDER BY price DESC;";
        } else {
            return "SELECT * FROM products;"; // default
        }
    }
}