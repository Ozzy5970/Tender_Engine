export interface AIServiceResponse {
    text: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export const generateText = async (prompt: string, systemContext?: string): Promise<AIServiceResponse> => {
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
        console.warn("OPENAI_API_KEY not found. Using Mock AI response.");
        return {
            text: `[MOCK AI OUTPUT]\n\nBased on your request: "${prompt.substring(0, 50)}..."\n\nThis is a simulated response because no API key was configured. In production, this would call the LLM provider.`,
            usage: { prompt_tokens: 0, completion_tokens: 0 }
        };
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemContext || 'You are a helpful assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error?.message || 'OpenAI API Error')
        }

        return {
            text: data.choices[0].message.content,
            usage: data.usage
        }

    } catch (error) {
        console.error("AI Service Error:", error)
        // Fallback to mock on error to prevent total blockage, but indicate failure
        return {
            text: `[ERROR] AI Generation Failed: ${error instanceof Error ? error.message : String(error)}`,
            usage: { prompt_tokens: 0, completion_tokens: 0 }
        }
    }
};
