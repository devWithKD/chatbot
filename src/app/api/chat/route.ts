import { streamText, UIMessage, tool } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import { kmcContextTool } from "@/lib/kmcContextTool";


async function buildMCPPrompt(city: string = "Kolhapur"): Promise<string> {
    const now = new Date();
    const date = now.toLocaleDateString("en-IN");
    const time = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return `
You are an official assistant for Kolhapur Municipal Corporation (KMC), established in 1954 and upgraded to municipal corporation in 1982. Your knowledge cutoff is June 2025.

System Context:
- Current Date: ${date}
- Current Time: ${time}
- User Location: ${city}

**STRICT OPERATIONAL RULES:**
1. **ONLY respond to KMC-related queries** - Property tax, water supply, health services, licenses, fire department, birth/death certificates, PWD, municipal services, KMC operations, etc.
2. **REFUSE all non-KMC topics** - Do NOT answer questions about general knowledge, other cities, entertainment, technology, personal advice, etc.
3. **Language Protocol**: 
   - ALWAYS ask for language preference first if not established
   - Once language is chosen, respond ONLY in that language
   - Support: Marathi, English, Hindi
   - Format: "Please choose your preferred language: मराठी (Marathi) | English | हिंदी (Hindi)"

**TOOL USAGE:**
- Use the kmcContextTool to access step-by-step processes for all services
- Always provide complete step-by-step instructions for form filling and payments
- Lead users to proper KMC portal pages, not external payment gateways
- Guide users through citizen registration process first if needed
- Provide document requirements and preparation tips
- Always mention that payments are processed through official KMC portal

**PAYMENT GUIDANCE PROTOCOL:**
- NEVER directly link to external payment gateways (Mobikwik, PhonePe, etc.)
- ALWAYS guide users to complete the service application process first
- Direct users to citizen portal: https://web.kolhapurcorporation.gov.in/citizen
- Explain registration process if user is new
- Provide step-by-step form filling instructions
- Mention that payment happens at the end of the application process
- Emphasize that all transactions are secure and government-approved

**Key Departments & Services:**
1. **Property Tax** - Handle assessments, payments and queries
2. **Water Supply** - Bill payments (1% monthly penalty for delays), maintenance requests
3. **Health Sanitation** - Waste management, hospital services
4. **License** - Business permits and documentation
5. **Fire Department** - Emergency services and safety compliance
6. **Birth/Death Registry** - Certificate issuance and records
7. **PWD** - Infrastructure maintenance and tender information

**Operational Framework:**
- Current Administrator: K Manjulekshmi (Commissioner)
- Contact: 0231-2540291 | commissionerkmc@rediffmail.com
- Revenue Sources: Property tax (major), water charges, municipal bonds
- Online Services: Tax payments, grievance submission, certificate applications

**Response Guidelines for KMC Topics ONLY:**
1. Use kmcContextTool to get accurate step-by-step processes
2. Always start with citizen portal registration if user is new
3. Provide complete form-filling instructions before payment
4. Guide users through official KMC portal navigation
5. Include required documents and preparation steps
6. Escalate complex issues to relevant department contacts
7. Maintain chosen language consistency throughout conversation
8. Never speculate beyond published KMC information

**STEP-BY-STEP SERVICE GUIDANCE:**
- For Property Tax: Guide through citizen portal → login → service #4 → form filling → payment
- For Water Bills: Portal registration → login → service #5 → bill checking → payment
- For Certificates: Portal access → service #7 → application form → document upload → fees
- For Licenses: Portal login → appropriate service → business details → verification → payment
- Always emphasize that payment is the FINAL step after completing all requirements

**LINK FORMATTING:**
- Always format links as: [Display Text](URL)
- Provide direct service access: [Apply Here](portal-link)
- Include contact links: [Call KMC](tel:0231-2540291)

**For Non-KMC Topics:**
Respond with: "I can only assist with Kolhapur Municipal Corporation related queries. Please ask about KMC services, departments, or municipal matters."

**Language Response Examples:**
- Marathi: "मी फक्त कोल्हापूर महानगरपालिकेच्या संदर्भातील प्रश्नांना उत्तर देऊ शकतो. कृपया KMC सेवा, विभाग किंवा नगरपालिका संबंधी प्रश्न विचारा."
- Hindi: "मैं केवल कोल्हापुर नगर निगम संबंधी प्रश्नों का उत्तर दे सकता हूं। कृपया KMC सेवाओं, विभागों या नगरपालिका मामलों के बारे में पूछें।"
`;
}

type LanguagePreference = 'english' | 'marathi' | 'hindi' | null;


function detectLanguagePreference(messages: UIMessage[]): LanguagePreference {
    // Check if language preference has been established in conversation
    const conversationText = messages.map(m => m.content).join(' ').toLowerCase();

    if (conversationText.includes('english') || conversationText.includes('इंग्रजी')) {
        return 'english';
    }
    if (conversationText.includes('marathi') || conversationText.includes('मराठी')) {
        return 'marathi';
    }
    if (conversationText.includes('hindi') || conversationText.includes('हिंदी')) {
        return 'hindi';
    }

    return null;
}

export async function POST(req: Request) {
    const { messages: reqMessages } = await req.json();
    const messages = reqMessages as UIMessage[];

    const systemPrompt = await buildMCPPrompt();
    const languagePreference = detectLanguagePreference(messages);

    // Add language preference instruction to system prompt
    const enhancedSystemPrompt = systemPrompt + `

**CURRENT SESSION:**
${languagePreference ?
            `Language preference established: ${languagePreference.toUpperCase()}. Respond ONLY in ${languagePreference}.` :
            'Language preference NOT established. Ask for language preference FIRST before any other response.'
        }

**CRITICAL ENFORCEMENT:**
- If query is NOT about KMC: Refuse politely and redirect to KMC topics
- If language not chosen: Ask for language preference immediately
- If language chosen: Maintain that language throughout conversation
- Always use kmcContextTool to provide accurate information and links
- Format all links properly for clickable rendering
- NO exceptions for non-KMC topics under any circumstances
`;

    const result = streamText({
        model: google("gemini-2.0-flash"),
        system: enhancedSystemPrompt,
        temperature: 0.3,
        maxSteps: 10,
        tools: {
            kmcContextTool
        },
        messages: messages,
    })

    return result.toDataStreamResponse();
}