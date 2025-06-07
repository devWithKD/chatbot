import { streamText, UIMessage, tool } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

// KMC Context Database with Step-by-Step Processes
const KMC_CONTEXT = {
    departments: {
        propertyTax: {
            name: "Property Tax Department",
            services: ["Tax assessment", "Online payments", "Arrears checking"],
            portalLink: "https://web.kolhapurcorporation.gov.in/citizen",
            contact: "0231-2540291",
            stepByStepProcess: {
                title: "Property Tax Payment - Step by Step Process",
                steps: [
                    "Visit KMC Official Website: https://web.kolhapurcorporation.gov.in/",
                    "Click on 'नागरिक लॉगिन' (Citizen Login) or go directly to: https://web.kolhapurcorporation.gov.in/citizen",
                    "If you are a new user, click 'नवीन नागरिक नोंदणी' (New Citizen Registration)",
                    "For registration, fill in: Town name, mobile number, email ID, password, name, city",
                    "After registration, login with your credentials",
                    "Navigate to Service #4: 'मिळकतकर थकबाकी पहा' (Property Tax Arrears)",
                    "Enter your property details: Address proof, previous bill, unique property number, owner name",
                    "Review your property tax amount and arrears",
                    "Click on payment option to proceed with online payment",
                    "Complete payment through the integrated payment gateway"
                ],
                documents: [
                    "Address proof of the property",
                    "Previous property tax bill",
                    "Unique property number",
                    "Owner identification documents"
                ]
            }
        },
        waterSupply: {
            name: "Water Supply Department",
            head: "Harshajit Dilipsinh Ghatage (Water Engineer)",
            services: ["Water bill payments", "New connections", "Maintenance requests"],
            penalty: "1% monthly penalty for delayed payments",
            portalLink: "https://web.kolhapurcorporation.gov.in/citizen",
            departmentLink: "https://web.kolhapurcorporation.gov.in/department?deptid=6",
            stepByStepProcess: {
                title: "Water Bill Payment - Step by Step Process",
                steps: [
                    "Visit KMC Official Website: https://web.kolhapurcorporation.gov.in/",
                    "Go to Citizen Portal: https://web.kolhapurcorporation.gov.in/citizen",
                    "Register as new user if not already registered (same process as property tax)",
                    "Login with your citizen portal credentials",
                    "Navigate to Service #5: 'पाणीपट्टी थकबाकी पहा' (Water Bill Arrears)",
                    "Enter your water connection number and consumer details",
                    "View your current water bill amount and any pending arrears",
                    "Click on payment option to proceed",
                    "Complete payment through secure payment gateway",
                    "Download payment receipt for your records"
                ],
                documents: [
                    "Water connection number",
                    "Consumer number",
                    "Previous water bill (if available)",
                    "Mobile number for SMS alerts"
                ],
                newConnection: {
                    title: "New Water Connection Process",
                    steps: [
                        "Visit Maharashtra Jeevan Pradhikaran website: mjp.maharashtra.gov.in",
                        "Click on 'Right to Services' on homepage",
                        "Select 'New Tap Connection' from services",
                        "Fill customer information, connection details, property information",
                        "Upload required documents: Proof of residence, identity documents",
                        "Enter customer consumer number",
                        "Pay application charges of Rs. 100/-",
                        "Submit the application",
                        "Wait for concerned officer to contact you"
                    ]
                }
            }
        },
        birthDeath: {
            name: "Birth/Death Registry",
            services: ["Birth certificate issuance", "Death certificate issuance"],
            portalLink: "https://web.kolhapurcorporation.gov.in/citizen",
            stepByStepProcess: {
                title: "Birth Certificate Application - Step by Step Process",
                steps: [
                    "Visit KMC Website: https://web.kolhapurcorporation.gov.in/",
                    "Go to Citizen Portal: https://web.kolhapurcorporation.gov.in/citizen",
                    "Complete citizen registration if new user",
                    "Login to your citizen account",
                    "Navigate to Service #7: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र' (Birth & Death Registration Certificate)",
                    "Select 'Birth Certificate' option",
                    "Fill in all required birth details: Child's name, date of birth, place of birth, parents' information",
                    "Upload supporting documents: Hospital discharge papers, parents' ID proof",
                    "Submit the application form",
                    "Pay the prescribed fees online",
                    "Track application status through the portal",
                    "Download certificate once approved"
                ],
                documents: [
                    "Hospital discharge summary/birth record",
                    "Parents' Aadhar card/identity proof",
                    "Parents' marriage certificate (if applicable)",
                    "Address proof",
                    "Any medical records from birth"
                ]
            }
        },
        license: {
            name: "License Department",
            services: ["Business permits", "Trade licenses", "Construction permissions"],
            portalLink: "https://web.kolhapurcorporation.gov.in/citizen",
            stepByStepProcess: {
                title: "Business License Application - Step by Step Process",
                steps: [
                    "Visit KMC Citizen Portal: https://web.kolhapurcorporation.gov.in/citizen",
                    "Register and login to your citizen account",
                    "Navigate to Service #6: 'परवाना थकबाकी पहा' (License Arrears) for renewals",
                    "For new license, go to Service #11: 'बांधकाम परवानगी' (Construction Permission)",
                    "Select appropriate license type: Trade License, Business Permit, etc.",
                    "Fill business details: Business name, type, address, owner information",
                    "Upload required documents: Shop/business address proof, owner ID, NOC documents",
                    "Submit application with required fees",
                    "Track application status online",
                    "Visit KMC office if physical verification is required",
                    "Download approved license certificate"
                ],
                documents: [
                    "Business address proof",
                    "Owner's identity and address proof",
                    "Shop/establishment ownership documents",
                    "NOC from fire department (if required)",
                    "Previous license copy (for renewals)"
                ]
            }
        }
    },

    generalProcess: {
        citizenRegistration: {
            title: "How to Register on KMC Citizen Portal",
            steps: [
                "Go to https://web.kolhapurcorporation.gov.in/citizen",
                "Click on 'वापरकर्ता नियमावली' (User Manual) to understand the process",
                "Click 'नवीन नागरिक नोंदणी' (New Citizen Registration)",
                "Fill registration form with: Town name, mobile number, email ID, password, full name, city",
                "Verify password by retyping",
                "Submit the registration form",
                "System will display entered details for verification",
                "Review all information carefully",
                "If changes needed, click 'Modify' to edit details",
                "Click 'Submit' to complete registration",
                "Use registered credentials to login for all services"
            ]
        },

        commonServices: [
            {
                service: "Complaint Registration",
                link: "Service #8: 'तक्रार स्थिती' (Complaint Status)",
                process: "Login → Navigate to Service #8 → Register new complaint → Track status"
            },
            {
                service: "RTI Application",
                link: "Service #12: 'आरटीआय पोर्टल्स' (RTI Portals)",
                process: "Login → Navigate to Service #12 → Fill RTI application → Submit with fees"
            },
            {
                service: "Waste Collection Schedule",
                link: "Service #9: 'घन कचरा संकलन वेळापत्रक'",
                process: "Login → Navigate to Service #9 → Select your ward → View schedule"
            }
        ]
    },

    paymentInfo: {
        note: "All payments are processed through the official KMC citizen portal after completing the respective service application forms. External payment apps can be used only after initiating the process through the official portal.",
        securePayment: "KMC uses secure, government-approved payment gateways integrated within the citizen portal for all transactions."
    }
};

// Context access tool
const kmcContextTool = tool({
    description: "Access specific KMC (Kolhapur Municipal Corporation) information, step-by-step processes, form filling instructions, and official portal navigation",
    parameters: z.object({
        category: z.enum([
            "departments",
            "generalProcess",
            "paymentInfo",
            "contact",
            "utilityInfo"
        ]).describe("Category of KMC information to retrieve"),
        subcategory: z.string().optional().describe("Specific subcategory within the main category (e.g., 'propertyTax', 'waterSupply', 'citizenRegistration')")
    }),
    execute: async ({ category, subcategory }) => {
        const categoryData = KMC_CONTEXT[category as keyof typeof KMC_CONTEXT];

        if (!categoryData) {
            return { error: "Category not found" };
        }

        if (subcategory && typeof categoryData === 'object' && (categoryData as Record<string, any>)[subcategory]) {
            return {
                category,
                subcategory,
                data: (categoryData as Record<string, any>)[subcategory]
            };
        }

        return {
            category,
            data: categoryData
        };
    }
});

async function buildMCPPrompt(city: string = "Delhi"): Promise<string> {
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
1. **Property Tax** - Handle assessments, payments (online via mobikwik), and queries
2. **Water Supply** - Bill payments (1% monthly penalty for delays), maintenance requests
3. **Health Sanitation** - Waste management, hospital services (Panchganga, Isolation)
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
- Social media: [Follow on Facebook](facebook-url)

**For Non-KMC Topics:**
Respond with: "I can only assist with Kolhapur Municipal Corporation related queries. Please ask about KMC services, departments, or municipal matters."

**Language Response Examples:**
- Marathi: "मी फक्त कोल्हापूर महानगरपालिकेच्या संदर्भातील प्रश्नांना उत्तर देऊ शकतो. कृपया KMC सेवा, विभाग किंवा नगरपालिका संबंधी प्रश्न विचारा."
- Hindi: "मैं केवल कोल्हापुर नगर निगम संबंधी प्रश्नों का उत्तर दे सकता हूं। कृपया KMC सेवाओं, विभागों या नगरपालिका मामलों के बारे में पूछें।"
`;
}

function detectLanguagePreference(messages: UIMessage[]): string | null {
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
        maxSteps: 10, // Increased to allow tool usage
        tools: {
            kmcContextTool
        },
        messages: messages,
    })

    return result.toDataStreamResponse();
}