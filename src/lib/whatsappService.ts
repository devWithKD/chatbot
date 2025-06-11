// src/lib/whatsappService.ts
import twilio from 'twilio';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { Redis } from '@upstash/redis';
import { kmcContextTool } from './kmcContextTool';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}

interface MenuOption {
    number: string;
    english: string;
    marathi: string;
    hindi: string;
    category: string;
}

export class WhatsAppService {
    private twilioClient: twilio.Twilio;
    private redis: Redis;

    // Predefined menu options
    private menuOptions: MenuOption[] = [
        {
            number: "1",
            english: "Property Tax Payment",
            marathi: "मिळकत कर भरणा",
            hindi: "संपत्ति कर भुगतान",
            category: "propertyTax"
        },
        {
            number: "2",
            english: "Water Bill Payment",
            marathi: "पाणी बिल भरणा",
            hindi: "पानी का बिल भुगतान",
            category: "waterSupply"
        },
        {
            number: "3",
            english: "Birth Certificate",
            marathi: "जन्म प्रमाणपत्र",
            hindi: "जन्म प्रमाण पत्र",
            category: "birthCertificate"
        },
        {
            number: "4",
            english: "Death Certificate",
            marathi: "मृत्यू प्रमाणपत्र",
            hindi: "मृत्यु प्रमाण पत्र",
            category: "deathCertificate"
        },
        {
            number: "5",
            english: "Business License",
            marathi: "व्यवसाय परवाना",
            hindi: "व्यापार लाइसेंस",
            category: "businessLicense"
        },
        {
            number: "6",
            english: "Register Complaint",
            marathi: "तक्रार नोंदवा",
            hindi: "शिकायत दर्ज करें",
            category: "complaint"
        },
        {
            number: "7",
            english: "Contact Information",
            marathi: "संपर्क माहिती",
            hindi: "संपर्क जानकारी",
            category: "contact"
        },
        {
            number: "8",
            english: "Other / Type your question",
            marathi: "इतर / आपला प्रश्न टाइप करा",
            hindi: "अन्य / अपना प्रश्न टाइप करें",
            category: "freeText"
        }
    ];

    constructor(accountSid: string, authToken: string) {
        this.twilioClient = twilio(accountSid, authToken);

        // Initialize Upstash Redis
        this.redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }

    async handleIncomingMessage(from: string, body: string): Promise<string> {
        try {
            const phoneNumber = from.replace('whatsapp:', '');

            // Get data from Redis with proper typing
            const historyData = await this.redis.get(`chat:${phoneNumber}`);
            const userState = await this.redis.get(`state:${phoneNumber}`) || 'initial';
            const userLanguage = await this.redis.get(`lang:${phoneNumber}`) || '';

            // Parse history data safely
            let history: ChatMessage[] = [];
            if (historyData && Array.isArray(historyData)) {
                history = historyData as ChatMessage[];
            } else if (typeof historyData === 'string') {
                try {
                    history = JSON.parse(historyData);
                } catch {
                    history = [];
                }
            }

            console.log(`🔍 DEBUG: Phone: ${phoneNumber}, State: ${userState}, Message: "${body}", History length: ${history.length}`);

            // Check if it's the first message or initial state
            if (history.length === 0 && userState === 'initial') {
                await this.redis.setex(`state:${phoneNumber}`, 3600, 'language_selection'); // 1 hour TTL
                console.log(`✅ Set state to language_selection for ${phoneNumber}`);
                return this.getLanguageSelectionMessage();
            }

            // Handle language selection
            if (userState === 'language_selection') {
                const language = this.handleLanguageSelection(body, phoneNumber);
                if (language) {
                    console.log(`✅ Language selected: ${language} for ${phoneNumber}`);
                    await this.redis.setex(`lang:${phoneNumber}`, 3600, language);
                    await this.redis.setex(`state:${phoneNumber}`, 3600, 'menu_shown');
                    return this.getMainMenuMessage(language as 'english' | 'marathi' | 'hindi');
                } else {
                    console.log(`❌ Invalid language choice: "${body}" for ${phoneNumber}`);
                    return this.getLanguageSelectionMessage();
                }
            }

            // Check if user selected a numbered option
            const selectedOption = this.parseMenuSelection(body);
            if (selectedOption) {
                const language = (userLanguage as string) || 'english';
                const response = await this.handleMenuSelection(selectedOption, phoneNumber, language);

                // Update history in Redis
                await this.updateConversationHistory(phoneNumber, body, response);

                return response;
            }

            // Handle free text or show menu again if user seems lost
            if (this.shouldShowMenu(body)) {
                const language = (userLanguage as string) || 'english';
                return this.getMainMenuMessage(language as 'english' | 'marathi' | 'hindi');
            }

            // Process with AI for free text
            const language = (userLanguage as string) || 'english';
            const response = await this.processWithKMCAI(body, history, language);

            // Update conversation history in Redis
            await this.updateConversationHistory(phoneNumber, body, response);

            // Add menu reminder at the end
            return response + "\n\n" + this.getMenuReminder(language);

        } catch (error) {
            console.error('❌ WhatsApp message processing error:', error);
            return "Sorry, I'm having trouble right now. Type 'menu' to see options or contact KMC at 0231-2540291.";
        }
    }

    private async updateConversationHistory(phoneNumber: string, userMessage: string, botResponse: string): Promise<void> {
        try {
            // Get existing history
            const historyData = await this.redis.get(`chat:${phoneNumber}`) || [];
            let history: ChatMessage[] = [];

            if (Array.isArray(historyData)) {
                history = historyData as ChatMessage[];
            } else if (typeof historyData === 'string') {
                try {
                    history = JSON.parse(historyData);
                } catch {
                    history = [];
                }
            }

            // Add new messages
            history.push(
                { role: 'user', content: userMessage, timestamp: new Date() },
                { role: 'assistant', content: botResponse, timestamp: new Date() }
            );

            // Keep only last 20 messages and save to Redis with 1 hour TTL
            const recentHistory = history.slice(-20);
            await this.redis.setex(`chat:${phoneNumber}`, 3600, JSON.stringify(recentHistory));

            console.log(`💾 Updated conversation history for ${phoneNumber}, total messages: ${recentHistory.length}`);
        } catch (error) {
            console.error('❌ Failed to update conversation history:', error);
        }
    }

    private getLanguageSelectionMessage(): string {
        return `🏛️ *Welcome to Kolhapur Municipal Corporation*
कोल्हापूर महानगरपालिकेत आपले स्वागत आहे

Please choose your language / कृपया आपली भाषा निवडा:

*1* - English
*2* - मराठी (Marathi)  
*3* - हिंदी (Hindi)

Reply with the number of your choice.`;
    }

    private handleLanguageSelection(message: string, phoneNumber: string): string | null {
        const choice = message.trim().toLowerCase();

        console.log(`🔍 Language selection input: "${choice}" for ${phoneNumber}`);

        if (choice === '1' || choice.includes('english')) {
            console.log(`✅ Language set to English for ${phoneNumber}`);
            return 'english';
        } else if (choice === '2' || choice.includes('मराठी') || choice.includes('marathi')) {
            console.log(`✅ Language set to Marathi for ${phoneNumber}`);
            return 'marathi';
        } else if (choice === '3' || choice.includes('हिंदी') || choice.includes('hindi')) {
            console.log(`✅ Language set to Hindi for ${phoneNumber}`);
            return 'hindi';
        }

        console.log(`❌ No language match for: "${choice}"`);
        return null;
    }

    private getMainMenuMessage(language: 'english' | 'marathi' | 'hindi'): string {
        const header = {
            english: "🏛️ *KMC Services Menu*\nWhat can I help you with today?",
            marathi: "🏛️ *KMC सेवा मेनू*\nआज मी तुमची काय मदत करू शकतो?",
            hindi: "🏛️ *KMC सेवा मेनू*\nआज मैं आपकी क्या मदत कर सकता हूं?"
        };

        const footer = {
            english: "\n💬 *Choose a number (1-8) or type your question directly*",
            marathi: "\n💬 *संख्या निवडा (1-8) किंवा आपला प्रश्न थेट टाइप करा*",
            hindi: "\n💬 *संख्या चुनें (1-8) या अपना प्रश्न सीधे टाइप करें*"
        };

        let menu = header[language] + "\n\n";

        this.menuOptions.forEach(option => {
            const text = language === 'marathi' ? option.marathi :
                language === 'hindi' ? option.hindi : option.english;
            menu += `*${option.number}* - ${text}\n`;
        });

        menu += footer[language];

        return menu;
    }

    private parseMenuSelection(message: string): MenuOption | null {
        const trimmed = message.trim();

        // Check for direct number selection (1, 2, 3, etc.)
        const option = this.menuOptions.find(opt => opt.number === trimmed);
        if (option) return option;

        // Check for text matching any option in any language
        const lowerMessage = message.toLowerCase();
        return this.menuOptions.find(opt =>
            lowerMessage.includes(opt.english.toLowerCase()) ||
            lowerMessage.includes(opt.marathi.toLowerCase()) ||
            lowerMessage.includes(opt.hindi.toLowerCase())
        ) || null;
    }

    private async handleMenuSelection(option: MenuOption, phoneNumber: string, language: string): Promise<string> {
        // Set user context for this service in Redis
        await this.redis.setex(`context:${phoneNumber}`, 3600, `service_${option.category}`);

        switch (option.category) {
            case 'propertyTax':
                return await this.getPropertyTaxInfo(language);

            case 'waterSupply':
                return await this.getWaterSupplyInfo(language);

            case 'birthCertificate':
            case 'deathCertificate':
                return await this.getCertificateInfo(option.category, language);

            case 'businessLicense':
                return await this.getBusinessLicenseInfo(language);

            case 'complaint':
                return await this.getComplaintInfo(language);

            case 'contact':
                return this.getContactInfo(language);

            case 'freeText':
                const prompt = {
                    english: "Please type your question about KMC services, and I'll help you:",
                    marathi: "कृपया KMC सेवांबद्दल आपला प्रश्न टाइप करा, मी तुमची मदत करेन:",
                    hindi: "कृपया KMC सेवाओं के बारे में अपना प्रश्न टाइप करें, मैं आपकी सहायता करूंगा:"
                };
                await this.redis.setex(`state:${phoneNumber}`, 3600, 'free_text_mode');
                return prompt[language as 'english' | 'marathi' | 'hindi'];

            default:
                return this.getMainMenuMessage(language as 'english' | 'marathi' | 'hindi');
        }
    }

    private async getPropertyTaxInfo(language: string): Promise<string> {
        const response = {
            english: `📊 *Property Tax Payment Process*

*Step-by-step guide:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Click 'नवीन नागरिक नोंदणी' for new registration
3️⃣ Login with your credentials
4️⃣ Navigate to Service #4: 'मिळकतकर थकबाकी पहा'
5️⃣ Enter property details
6️⃣ Review amount and pay online

*Documents needed:*
- Address proof of property
- Previous tax bill (if available)
- Property ownership documents

*Contact:* 0231-2540291

Would you like help with registration or have other questions?`,

            marathi: `📊 *मिळकत कर भरण्याची प्रक्रिया*

*चरणबद्ध मार्गदर्शन:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नवीन नोंदणीसाठी 'नवीन नागरिक नोंदणी' वर क्लिक करा
3️⃣ आपल्या क्रेडेंशियलने लॉगिन करा
4️⃣ सेवा #4 वर जा: 'मिळकतकर थकबाकी पहा'
5️⃣ मालमत्तेचे तपशील भरा
6️⃣ रकमेचे पुनरावलोकन करा आणि ऑनलाइन पेमेंट करा

*आवश्यक कागदपत्रे:*
- मालमत्तेचा पत्ता पुरावा
- मागील कर बिल (उपलब्ध असल्यास)
- मालमत्ता मालकीचे कागदपत्रे

*संपर्क:* 0231-2540291

नोंदणीसाठी मदत हवी आहे किंवा इतर प्रश्न आहेत?`,

            hindi: `📊 *संपत्ति कर भुगतान प्रक्रिया*

*चरणबद्ध गाइड:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नए पंजीकरण के लिए 'नवीन नागरिक नोंदणी' पर क्लिक करें
3️⃣ अपने क्रेडेंशियल्स से लॉगिन करें
4️⃣ सेवा #4 पर जाएं: 'मिळकतकर थकबाकी पहा'
5️⃣ संपत्ति विवरण भरें
6️⃣ राशि की समीक्षा करें और ऑनलाइन भुगतान करें

*आवश्यक दस्तावेज:*
- संपत्ति का पता प्रमाण
- पिछला कर बिल (यदि उपलब्ध हो)
- संपत्ति स्वामित्व दस्तावेज

*संपर्क:* 0231-2540291

क्या पंजीकरण में मदत चाहिए या अन्य प्रश्न हैं?`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private async getWaterSupplyInfo(language: string): Promise<string> {
        const response = {
            english: `💧 *Water Supply Services*

*Bill Payment Process:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Register/Login to citizen portal
3️⃣ Navigate to Service #5: 'पाणीपट्टी थकबाकी पहा'
4️⃣ Enter water connection number
5️⃣ View bill amount and pay online

*New Connection:*
- Visit: mjp.maharashtra.gov.in
- Apply for new tap connection
- Application fee: ₹100

*Important:* 1% monthly penalty for delayed payments

*Contact:* Water Engineer - Harshajit Dilipsinh Ghatage
*Phone:* 0231-2540291`,

            marathi: `💧 *पाणी पुरवठा सेवा*

*बिल भरण्याची प्रक्रिया:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टलवर नोंदणी/लॉगिन करा
3️⃣ सेवा #5 वर जा: 'पाणीपट्टी थकबाकी पहा'
4️⃣ पाणी कनेक्शन नंबर टाका
5️⃣ बिलची रक्कम पहा आणि ऑनलाइन पेमेंट करा

*नवीन कनेक्शन:*
- भेट द्या: mjp.maharashtra.gov.in
- नवीन टॅप कनेक्शनसाठी अर्ज करा
- अर्ज फी: ₹100

*महत्वाचे:* उशीरा पेमेंटसाठी 1% मासिक दंड

*संपर्क:* पाणी अभियंता - हर्षजित दिलीपसिंह घाटगे
*फोन:* 0231-2540291`,

            hindi: `💧 *जल आपूर्ति सेवाएं*

*बिल भुगतान प्रक्रिया:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टल पर पंजीकरण/लॉगिन करें
3️⃣ सेवा #5 पर जाएं: 'पाणीपट्टी थकबाकी पहा'
4️⃣ पानी कनेक्शन नंबर डालें
5️⃣ बिल राशि देखें और ऑनलाइन भुगतान करें

*नया कनेक्शन:*
- विजिट करें: mjp.maharashtra.gov.in
- नए टैप कनेक्शन के लिए आवेदन करें
- आवेदन शुल्क: ₹100

*महत्वपूर्ण:* देर से भुगतान के लिए 1% मासिक जुर्माना

*संपर्क:* जल अभियंता - हर्षजित दिलीपसिंह घाटगे
*फोन:* 0231-2540291`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private async getCertificateInfo(type: string, language: string): Promise<string> {
        const isBirth = type === 'birthCertificate';
        const response = {
            english: `📋 *${isBirth ? 'Birth' : 'Death'} Certificate Application*

*Online Process:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Register/Login to citizen portal
3️⃣ Navigate to Service #7: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ Select '${isBirth ? 'Birth' : 'Death'} Certificate'
5️⃣ Fill required details
6️⃣ Upload documents and pay fees

*Required Documents:*
${isBirth ?
                    '• Hospital discharge papers\n• Parents\' Aadhar cards\n• Parents\' marriage certificate' :
                    '• Death certificate from hospital\n• Deceased person\'s Aadhar\n• Family member\'s ID proof'
                }

*Contact:* 0231-2540291`,

            marathi: `📋 *${isBirth ? 'जन्म' : 'मृत्यू'} प्रमाणपत्र अर्ज*

*ऑनलाइन प्रक्रिया:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टलवर नोंदणी/लॉगिन करा
3️⃣ सेवा #7 वर जा: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ '${isBirth ? 'जन्म' : 'मृत्यू'} प्रमाणपत्र' निवडा
5️⃣ आवश्यक तपशील भरा
6️⃣ कागदपत्रे अपलोड करा आणि फी भरा

*आवश्यक कागदपत्रे:*
${isBirth ?
                    '• हॉस्पिटल डिस्चार्ज पेपर्स\n• पालकांचे आधार कार्ड\n• पालकांचे लग्न प्रमाणपत्र' :
                    '• हॉस्पिटलकडून मृत्यू प्रमाणपत्र\n• मृत व्यक्तीचे आधार\n• कुटुंबातील सदस्याचा आयडी पुरावा'
                }

*संपर्क:* 0231-2540291`,

            hindi: `📋 *${isBirth ? 'जन्म' : 'मृत्यु'} प्रमाण पत्र आवेदन*

*ऑनलाइन प्रक्रिया:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टल पर पंजीकरण/लॉगिन करें
3️⃣ सेवा #7 पर जाएं: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ '${isBirth ? 'जन्म' : 'मृत्यु'} प्रमाण पत्र' चुनें
5️⃣ आवश्यक विवरण भरें
6️⃣ दस्तावेज अपलोड करें और शुल्क भरें

*आवश्यक दस्तावेज:*
${isBirth ?
                    '• अस्पताल डिस्चार्ज पेपर्स\n• माता-पिता के आधार कार्ड\n• माता-पिता का विवाह प्रमाण पत्र' :
                    '• अस्पताल से मृत्यु प्रमाण पत्र\n• मृतक व्यक्ति का आधार\n• परिवार के सदस्य का आईडी प्रूफ'
                }

*संपर्क:* 0231-2540291`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private async getBusinessLicenseInfo(language: string): Promise<string> {
        const response = {
            english: `📄 *Business License Application*

*Online Process:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Register/Login to citizen portal
3️⃣ For new license: Service #11: 'बांधकाम परवानगी'
4️⃣ For renewals: Service #6: 'परवाना थकबाकी पहा'
5️⃣ Fill business details
6️⃣ Upload documents and pay fees

*Required Documents:*
- Business address proof
- Owner's ID and address proof
- Shop establishment documents
- NOC from fire department (if required)

*Contact:* 0231-2540291`,

            marathi: `📄 *व्यवसाय परवाना अर्ज*

*ऑनलाइन प्रक्रिया:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टलवर नोंदणी/लॉगिन करा
3️⃣ नवीन परवान्यासाठी: सेवा #11: 'बांधकाम परवानगी'
4️⃣ नूतनीकरणासाठी: सेवा #6: 'परवाना थकबाकी पहा'
5️⃣ व्यवसायाचे तपशील भरा
6️⃣ कागदपत्रे अपलोड करा आणि फी भरा

*आवश्यक कागदपत्रे:*
- व्यवसायाचा पत्ता पुरावा
- मालकाचा आयडी आणि पत्ता पुरावा
- दुकान स्थापना कागदपत्रे
- अग्निशमन विभागाकडून NOC (आवश्यक असल्यास)

*संपर्क:* 0231-2540291`,

            hindi: `📄 *व्यापार लाइसेंस आवेदन*

*ऑनलाइन प्रक्रिया:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टल पर पंजीकरण/लॉगिन करें
3️⃣ नए लाइसेंस के लिए: सेवा #11: 'बांधकाम परवानगी'
4️⃣ नवीनीकरण के लिए: सेवा #6: 'परवाना थकबाकी पहा'
5️⃣ व्यापार विवरण भरें
6️⃣ दस्तावेज अपलोड करें और शुल्क भरें

*आवश्यक दस्तावेज:*
- व्यापार पता प्रमाण
- मालिक का आईडी और पता प्रमाण
- दुकान स्थापना दस्तावेज
- अग्निशमन विभाग से NOC (यदि आवश्यक हो)

*संपर्क:* 0231-2540291`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private async getComplaintInfo(language: string): Promise<string> {
        const response = {
            english: `📝 *Register Complaint*

*Online Process:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Register/Login to citizen portal
3️⃣ Navigate to Service #8: 'तक्रार स्थिती'
4️⃣ Register new complaint
5️⃣ Fill complaint details
6️⃣ Submit and track status online

*Types of Complaints:*
- Road maintenance issues
- Water supply problems
- Garbage collection
- Street light issues
- Drainage problems

*Emergency Contact:* 0231-2540291`,

            marathi: `📝 *तक्रार नोंदवा*

*ऑनलाइन प्रक्रिया:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टलवर नोंदणी/लॉगिन करा
3️⃣ सेवा #8 वर जा: 'तक्रार स्थिती'
4️⃣ नवीन तक्रार नोंदवा
5️⃣ तक्रारीचे तपशील भरा
6️⃣ सबमिट करा आणि ऑनलाइन स्थिती ट्रॅक करा

*तक्रारीचे प्रकार:*
- रस्ता दुरुस्तीच्या समस्या
- पाणी पुरवठ्याच्या समस्या
- कचरा गोळा करणे
- रस्ता दिव्याच्या समस्या
- गटारीच्या समस्या

*आपत्कालीन संपर्क:* 0231-2540291`,

            hindi: `📝 *शिकायत दर्ज करें*

*ऑनलाइन प्रक्रिया:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टल पर पंजीकरण/लॉगिन करें
3️⃣ सेवा #8 पर जाएं: 'तक्रार स्थिती'
4️⃣ नई शिकायत दर्ज करें
5️⃣ शिकायत का विवरण भरें
6️⃣ सबमिट करें और ऑनलाइन स्थिति ट्रैक करें

*शिकायत के प्रकार:*
- सड़क रखरखाव की समस्याएं
- पानी की आपूर्ति की समस्याएं
- कचरा संग्रह
- स्ट्रीट लाइट की समस्याएं
- जल निकासी की समस्याएं

*आपातकालीन संपर्क:* 0231-2540291`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private getContactInfo(language: string): string {
        const response = {
            english: `📞 *Kolhapur Municipal Corporation Contact*

*Main Office:*
Phone: 0231-2540291
Email: commissionerkmc@rediffmail.com

*Commissioner:* K Manjulekshmi

*Office Address:*
Kolhapur Municipal Corporation
Kolhapur, Maharashtra

*Portal:* https://web.kolhapurcorporation.gov.in/

*Office Hours:*
Monday to Saturday: 10:00 AM - 5:00 PM

*Emergency Services:* Available 24/7`,

            marathi: `📞 *कोल्हापूर महानगरपालिका संपर्क*

*मुख्य कार्यालय:*
फोन: 0231-2540291
ईमेल: commissionerkmc@rediffmail.com

*आयुक्त:* के मंजुलेक्ष्मी

*कार्यालयाचा पत्ता:*
कोल्हापूर महानगरपालिका
कोल्हापूर, महाराष्ट्र

*पोर्टल:* https://web.kolhapurcorporation.gov.in/

*कार्यालयीन वेळा:*
सोमवार ते शनिवार: सकाळी 10:00 - संध्याकाळी 5:00

*आपत्कालीन सेवा:* 24/7 उपलब्ध`,

            hindi: `📞 *कोल्हापुर नगर निगम संपर्क*

*मुख्य कार्यालय:*
फोन: 0231-2540291
ईमेल: commissionerkmc@rediffmail.com

*आयुक्त:* के मंजुलेक्ष्मी

*कार्यालय का पता:*
कोल्हापुर नगर निगम
कोल्हापुर, महाराष्ट्र

*पोर्टल:* https://web.kolhapurcorporation.gov.in/

*कार्यालय समय:*
सोमवार से शनिवार: सुबह 10:00 - शाम 5:00

*आपातकालीन सेवा:* 24/7 उपलब्ध`
        };

        return response[language as 'english' | 'marathi' | 'hindi'] + "\n\n" + this.getMenuReminder(language);
    }

    private shouldShowMenu(body: string): boolean {
        const menuTriggers = ['menu', 'help', 'options', 'services', 'मेनू', 'मदत', 'सेवा', 'मेन्यू', 'सहायता'];
        return menuTriggers.some(trigger => body.toLowerCase().includes(trigger));
    }

    private getMenuReminder(language: string): string {
        const reminder = {
            english: "💬 Type 'menu' to see all options again or contact us at 0231-2540291",
            marathi: "💬 सर्व पर्याय पुन्हा पाहण्यासाठी 'menu' टाइप करा किंवा 0231-2540291 वर संपर्क करा",
            hindi: "💬 सभी विकल्प फिर से देखने के लिए 'menu' टाइप करें या 0231-2540291 पर संपर्क करें"
        };
        return `---\n${reminder[language as 'english' | 'marathi' | 'hindi']}`;
    }

    // Process with your existing KMC AI logic
    private async processWithKMCAI(userMessage: string, history: ChatMessage[], language: string): Promise<string> {
        try {
            // Use your existing buildMCPPrompt and kmcContextTool logic
            const systemPrompt = await this.buildKMCPrompt(language);

            const result = await streamText({
                model: google("gemini-2.0-flash"),
                system: systemPrompt,
                temperature: 0.3,
                maxSteps: 10,
                tools: {
                    kmcContextTool
                },
                messages: [
                    ...history,
                    { role: 'user', content: userMessage }
                ],
            });

            let fullResponse = '';
            for await (const textPart of result.textStream) {
                fullResponse += textPart;
            }

            return fullResponse || "I apologize, but I couldn't generate a proper response. Please try asking about KMC services or type 'menu' to see options.";
        } catch (error) {
            console.error('KMC AI processing error:', error);
            return "I'm having trouble processing your request. Please type 'menu' to see service options or contact KMC at 0231-2540291.";
        }
    }

    private async buildKMCPrompt(language: string): Promise<string> {
        // Copy your existing buildMCPPrompt function logic here
        const now = new Date();
        const date = now.toLocaleDateString("en-IN");
        const time = now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
        });

        let languageInstruction = '';
        if (language === 'marathi') {
            languageInstruction = 'Respond ONLY in Marathi (मराठी). All responses must be in Marathi language.';
        } else if (language === 'hindi') {
            languageInstruction = 'Respond ONLY in Hindi (हिंदी). All responses must be in Hindi language.';
        } else if (language === 'english') {
            languageInstruction = 'Respond ONLY in English. All responses must be in English language.';
        }

        return `
You are an official WhatsApp assistant for Kolhapur Municipal Corporation (KMC), established in 1954 and upgraded to municipal corporation in 1982.

System Context:
- Current Date: ${date}
- Current Time: ${time}
- Platform: WhatsApp (Twilio)
- Language: ${language}

**STRICT OPERATIONAL RULES:**
1. **ONLY respond to KMC-related queries** - Property tax, water supply, health services, licenses, fire department, birth/death certificates, PWD, municipal services, KMC operations, etc.
2. **REFUSE all non-KMC topics** - Do NOT answer questions about general knowledge, other cities, entertainment, technology, personal advice, etc.
3. **Language Protocol**: ${languageInstruction}

**WHATSAPP-SPECIFIC FORMATTING:**
- Keep responses concise and mobile-friendly (under 1500 characters)
- Use simple formatting with emojis
- Break long responses into shorter paragraphs
- Provide direct links without complex formatting
- Include phone numbers in clickable format

**KEY DEPARTMENTS & SERVICES:**
1. **Property Tax** 📊 - Handle assessments, payments and queries
2. **Water Supply** 💧 - Bill payments (1% monthly penalty for delays), maintenance requests  
3. **Health Sanitation** 🏥 - Waste management, hospital services
4. **License** 📄 - Business permits and documentation
5. **Fire Department** 🚒 - Emergency services and safety compliance
6. **Birth/Death Registry** 📋 - Certificate issuance and records
7. **PWD** 🏗️ - Infrastructure maintenance and tender information

**RESPONSE GUIDELINES:**
1. Use kmcContextTool to get accurate step-by-step processes
2. Always guide through official KMC portal: https://web.kolhapurcorporation.gov.in/citizen
3. Provide complete form-filling instructions before payment
4. Include required documents and preparation steps
5. Keep responses under 1500 characters when possible
6. Use bullet points for lists
7. Provide contact: 0231-2540291

**For Non-KMC Topics:**
Respond with: "I can only assist with Kolhapur Municipal Corporation related queries. Please ask about KMC services or type 'menu' to see options."

Always use kmcContextTool to provide accurate information and step-by-step guidance.
`;
    }

    async sendMessage(to: string, message: string): Promise<void> {
        await this.twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER!,
            to: to,
            body: message
        });
    }

    // Handle commands like /help, /clear, etc.
    async handleCommand(command: string, phoneNumber: string): Promise<string | null> {
        const cmd = command.toLowerCase().trim();

        switch (cmd) {
            case '/help':
                const userLanguage = await this.redis.get(`lang:${phoneNumber}`) || 'english';
                return this.getMainMenuMessage(userLanguage as 'english' | 'marathi' | 'hindi');

            case '/clear':
                // Clear all Redis data for this user
                await this.redis.del(`chat:${phoneNumber}`);
                await this.redis.del(`lang:${phoneNumber}`);
                await this.redis.del(`state:${phoneNumber}`);
                await this.redis.del(`context:${phoneNumber}`);
                console.log(`🗑️ Cleared all data for ${phoneNumber}`);
                return "✅ Conversation history cleared! You can start fresh.";

            case '/menu':
                const language = await this.redis.get(`lang:${phoneNumber}`) || 'english';
                return this.getMainMenuMessage(language as 'english' | 'marathi' | 'hindi');

            default:
                return null;
        }
    }
}