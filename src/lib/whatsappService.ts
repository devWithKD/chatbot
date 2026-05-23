// src/lib/whatsappService.ts - Part 1: Core Class & Language Handling
import twilio from "twilio";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { Redis } from "@upstash/redis";
import { kmcContextTool } from "./kmcContextTool";

interface ChatMessage {
  role: "user" | "assistant" | "system";
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

  // Updated menu options with Disaster Management as #1
  private menuOptions: MenuOption[] = [
    {
      number: "1",
      english: "🚨 Disaster Management",
      marathi: "🚨 आपत्ती व्यवस्थापन",
      hindi: "🚨 आपदा प्रबंधन",
      category: "disasterManagement",
    },
    {
      number: "2",
      english: "Property Tax Payment",
      marathi: "मिळकत कर भरणा",
      hindi: "संपत्ति कर भुगतान",
      category: "propertyTax",
    },
    {
      number: "3",
      english: "Water Bill Payment",
      marathi: "पाणी बिल भरणा",
      hindi: "पानी का बिल भुगतान",
      category: "waterSupply",
    },
    {
      number: "4",
      english: "Birth Certificate",
      marathi: "जन्म प्रमाणपत्र",
      hindi: "जन्म प्रमाण पत्र",
      category: "birthCertificate",
    },
    {
      number: "5",
      english: "Death Certificate",
      marathi: "मृत्यू प्रमाणपत्र",
      hindi: "मृत्यु प्रमाण पत्र",
      category: "deathCertificate",
    },
    {
      number: "6",
      english: "Business License",
      marathi: "व्यवसाय परवाना",
      hindi: "व्यापार लाइसेंस",
      category: "businessLicense",
    },
    {
      number: "7",
      english: "Register Complaint",
      marathi: "तक्रार नोंदवा",
      hindi: "शिकायत दर्ज करें",
      category: "complaint",
    },
    {
      number: "8",
      english: "Contact Information",
      marathi: "संपर्क माहिती",
      hindi: "संपर्क जानकारी",
      category: "contact",
    },
    {
      number: "9",
      english: "Other / Type your question",
      marathi: "इतर / आपला प्रश्न टाइप करा",
      hindi: "अन्य / अपना प्रश्न टाइप करें",
      category: "freeText",
    },
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
      const phoneNumber = from.replace("whatsapp:", "");

      // Get data from Redis with proper typing
      const historyData = await this.redis.get(`chat:${phoneNumber}`);
      const userState =
        (await this.redis.get(`state:${phoneNumber}`)) || "initial";
      const userLanguage = (await this.redis.get(`lang:${phoneNumber}`)) || "";

      // Parse history data safely
      let history: ChatMessage[] = [];
      if (historyData && Array.isArray(historyData)) {
        history = historyData as ChatMessage[];
      } else if (typeof historyData === "string") {
        try {
          history = JSON.parse(historyData);
        } catch {
          history = [];
        }
      }

      console.log(
        `🔍 DEBUG: Phone: ${phoneNumber}, State: ${userState}, Message: "${body}", History length: ${history.length}`,
      );

      // Check if it's the first message or initial state
      if (history.length === 0 && userState === "initial") {
        await this.redis.setex(
          `state:${phoneNumber}`,
          3600,
          "language_selection",
        ); // 1 hour TTL
        console.log(`✅ Set state to language_selection for ${phoneNumber}`);
        return this.getLanguageSelectionMessage();
      }

      // Handle language selection
      if (userState === "language_selection") {
        const language = this.handleLanguageSelection(body, phoneNumber);
        if (language) {
          console.log(`✅ Language selected: ${language} for ${phoneNumber}`);
          await this.redis.setex(`lang:${phoneNumber}`, 3600, language);
          await this.redis.setex(`state:${phoneNumber}`, 3600, "menu_shown");
          return this.getMainMenuMessage(
            language as "english" | "marathi" | "hindi",
          );
        } else {
          console.log(
            `❌ Invalid language choice: "${body}" for ${phoneNumber}`,
          );
          return this.getLanguageSelectionMessage();
        }
      }

      // Handle disaster management sub-menu
      if (userState === "disaster_submenu") {
        const language = (userLanguage as string) || "english";
        const subOption = this.parseDisasterSubMenu(body);
        if (subOption) {
          const response = await this.handleDisasterSubMenu(
            subOption,
            phoneNumber,
            language,
          );
          await this.updateConversationHistory(phoneNumber, body, response);
          return response;
        } else {
          // Invalid option, show disaster submenu again
          return this.getDisasterSubMenu(language);
        }
      }

      // Check if user selected a numbered option
      const selectedOption = this.parseMenuSelection(body);
      if (selectedOption) {
        const language = (userLanguage as string) || "english";
        const response = await this.handleMenuSelection(
          selectedOption,
          phoneNumber,
          language,
        );

        // Update history in Redis
        await this.updateConversationHistory(phoneNumber, body, response);

        return response;
      }

      // Handle free text or show menu again if user seems lost
      if (this.shouldShowMenu(body)) {
        const language = (userLanguage as string) || "english";
        return this.getMainMenuMessage(
          language as "english" | "marathi" | "hindi",
        );
      }

      // Process with AI for free text
      const language = (userLanguage as string) || "english";
      const response = await this.processWithKMCAI(body, history, language);

      // Update conversation history in Redis
      await this.updateConversationHistory(phoneNumber, body, response);

      // Add menu reminder at the end
      return response + "\n\n" + this.getMenuReminder(language);
    } catch (error) {
      console.error("❌ WhatsApp message processing error:", error);
      return "Sorry, I'm having trouble right now. Type 'menu' to see options or contact KMC at 0231-2540291.";
    }
  }

  private async updateConversationHistory(
    phoneNumber: string,
    userMessage: string,
    botResponse: string,
  ): Promise<void> {
    try {
      // Get existing history
      const historyData = (await this.redis.get(`chat:${phoneNumber}`)) || [];
      let history: ChatMessage[] = [];

      if (Array.isArray(historyData)) {
        history = historyData as ChatMessage[];
      } else if (typeof historyData === "string") {
        try {
          history = JSON.parse(historyData);
        } catch {
          history = [];
        }
      }

      // Add new messages
      history.push(
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: botResponse, timestamp: new Date() },
      );

      // Keep only last 20 messages and save to Redis with 1 hour TTL
      const recentHistory = history.slice(-20);
      await this.redis.setex(
        `chat:${phoneNumber}`,
        3600,
        JSON.stringify(recentHistory),
      );

      console.log(
        `💾 Updated conversation history for ${phoneNumber}, total messages: ${recentHistory.length}`,
      );
    } catch (error) {
      console.error("❌ Failed to update conversation history:", error);
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

  private handleLanguageSelection(
    message: string,
    phoneNumber: string,
  ): string | null {
    const choice = message.trim().toLowerCase();

    console.log(`🔍 Language selection input: "${choice}" for ${phoneNumber}`);

    if (choice === "1" || choice.includes("english")) {
      console.log(`✅ Language set to English for ${phoneNumber}`);
      return "english";
    } else if (
      choice === "2" ||
      choice.includes("मराठी") ||
      choice.includes("marathi")
    ) {
      console.log(`✅ Language set to Marathi for ${phoneNumber}`);
      return "marathi";
    } else if (
      choice === "3" ||
      choice.includes("हिंदी") ||
      choice.includes("hindi")
    ) {
      console.log(`✅ Language set to Hindi for ${phoneNumber}`);
      return "hindi";
    }

    console.log(`❌ No language match for: "${choice}"`);
    return null;
  }

  private getMainMenuMessage(
    language: "english" | "marathi" | "hindi",
  ): string {
    const header = {
      english: "🏛️ *KMC Services Menu*\nWhat can I help you with today?",
      marathi: "🏛️ *KMC सेवा मेनू*\nआज मी तुमची काय मदत करू शकतो?",
      hindi: "🏛️ *KMC सेवा मेनू*\nआज मैं आपकी क्या मदत कर सकता हूं?",
    };

    const footer = {
      english: "\n💬 *Choose a number (1-9) or type your question directly*",
      marathi: "\n💬 *संख्या निवडा (1-9) किंवा आपला प्रश्न थेट टाइप करा*",
      hindi: "\n💬 *संख्या चुनें (1-9) या अपना प्रश्न सीधे टाइप करें*",
    };

    let menu = header[language] + "\n\n";

    this.menuOptions.forEach((option) => {
      const text =
        language === "marathi"
          ? option.marathi
          : language === "hindi"
            ? option.hindi
            : option.english;
      menu += `*${option.number}* - ${text}\n`;
    });

    menu += footer[language];

    return menu;
  }

  // Utility methods
  private shouldShowMenu(body: string): boolean {
    const menuTriggers = [
      "menu",
      "help",
      "options",
      "services",
      "मेनू",
      "मदत",
      "सेवा",
      "मेन्यू",
      "सहायता",
    ];
    return menuTriggers.some((trigger) => body.toLowerCase().includes(trigger));
  }

  private getMenuReminder(language: string): string {
    const reminder = {
      english:
        "💬 Type 'menu' to see all options again or contact us at 0231-2540291",
      marathi:
        "💬 सर्व पर्याय पुन्हा पाहण्यासाठी 'menu' टाइप करा किंवा 0231-2540291 वर संपर्क करा",
      hindi:
        "💬 सभी विकल्प फिर से देखने के लिए 'menu' टाइप करें या 0231-2540291 पर संपर्क करें",
    };
    return `---\n${reminder[language as "english" | "marathi" | "hindi"]}`;
  }

  async sendMessage(to: string, message: string): Promise<void> {
    await this.twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER!,
      to: to,
      body: message,
    });
  }

  // Handle commands like /help, /clear, etc.
  async handleCommand(
    command: string,
    phoneNumber: string,
  ): Promise<string | null> {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case "/help":
        const userLanguage =
          (await this.redis.get(`lang:${phoneNumber}`)) || "english";
        return this.getMainMenuMessage(
          userLanguage as "english" | "marathi" | "hindi",
        );

      case "/clear":
        // Clear all Redis data for this user
        await this.redis.del(`chat:${phoneNumber}`);
        await this.redis.del(`lang:${phoneNumber}`);
        await this.redis.del(`state:${phoneNumber}`);
        await this.redis.del(`context:${phoneNumber}`);
        console.log(`🗑️ Cleared all data for ${phoneNumber}`);
        return "✅ Conversation history cleared! You can start fresh.";

      case "/menu":
        const language =
          (await this.redis.get(`lang:${phoneNumber}`)) || "english";
        return this.getMainMenuMessage(
          language as "english" | "marathi" | "hindi",
        );

      default:
        return null;
    }
  }

  // src/lib/whatsappService.ts - Part 2: Menu Handling & Navigation
  // Add these methods to the WhatsAppService class

  private parseMenuSelection(message: string): MenuOption | null {
    const trimmed = message.trim();

    // Check for direct number selection (1, 2, 3, etc.)
    const option = this.menuOptions.find((opt) => opt.number === trimmed);
    if (option) return option;

    // Check for text matching any option in any language
    const lowerMessage = message.toLowerCase();
    return (
      this.menuOptions.find(
        (opt) =>
          lowerMessage.includes(opt.english.toLowerCase()) ||
          lowerMessage.includes(opt.marathi.toLowerCase()) ||
          lowerMessage.includes(opt.hindi.toLowerCase()),
      ) || null
    );
  }

  private async handleMenuSelection(
    option: MenuOption,
    phoneNumber: string,
    language: string,
  ): Promise<string> {
    // Set user context for this service in Redis
    await this.redis.setex(
      `context:${phoneNumber}`,
      3600,
      `service_${option.category}`,
    );

    switch (option.category) {
      case "disasterManagement":
        // Set state to disaster submenu
        await this.redis.setex(
          `state:${phoneNumber}`,
          3600,
          "disaster_submenu",
        );
        return this.getDisasterSubMenu(language);

      case "propertyTax":
        return await this.getPropertyTaxInfo(language);

      case "waterSupply":
        return await this.getWaterSupplyInfo(language);

      case "birthCertificate":
      case "deathCertificate":
        return await this.getCertificateInfo(option.category, language);

      case "businessLicense":
        return await this.getBusinessLicenseInfo(language);

      case "complaint":
        return await this.getComplaintInfo(language);

      case "contact":
        return this.getContactInfo(language);

      case "freeText":
        const prompt = {
          english:
            "Please type your question about KMC services, and I'll help you:",
          marathi:
            "कृपया KMC सेवांबद्दल आपला प्रश्न टाइप करा, मी तुमची मदत करेन:",
          hindi:
            "कृपया KMC सेवाओं के बारे में अपना प्रश्न टाइप करें, मैं आपकी सहायता करूंगा:",
        };
        await this.redis.setex(`state:${phoneNumber}`, 3600, "free_text_mode");
        return prompt[language as "english" | "marathi" | "hindi"];

      default:
        return this.getMainMenuMessage(
          language as "english" | "marathi" | "hindi",
        );
    }
  }

  private getDisasterSubMenu(language: string): string {
    if (language === "marathi") {
      return `🚨 *कोल्हापूर आपत्ती व्यवस्थापन विभाग*

कोल्हापूर आपत्ती व्यवस्थापन विभागाच्या स्वयं माहिती प्रणालीमध्ये आपले स्वागत आहे.

खाली नमूद पर्यायांपुर्वी दिलेल्या क्रमांक रिप्लाय ऑप्शनमध्ये पाठवून जिल्ह्यातील सद्यस्थिती बाबत आपण माहिती घेऊ शकता.

उदा. आपल्याला पर्जन्यमानाबाबत माहिती हवी असेल तर *1* असा रिप्लाय करा.

*1* - 🌧️ पर्जन्यमान (Rainfall)
*2* - 🌊 धरण व पाणी पातळी अहवाल (Water Level Information)
*3* - 🏞️ पंचगंगा पाणी पातळी (Panchaganga River Water Level)
*4* - 📞 आपत्कालीन संपर्क क्रमांक (Emergency Contact)
*5* - 🚗 रस्ते व वहातूक (Road and Transport)
*6* - ⚠️ पुर पातळी नुसार पाणी भागात येण्याची संभाव्य ठिकाणे
*7* - ⬅️ मुख्य मेनूवर परत या`;
    } else if (language === "hindi") {
      return `🚨 *कोल्हापुर आपदा प्रबंधन विभाग*

कोल्हापुर आपदा प्रबंधन विभाग की स्वचालित सूचना प्रणाली में आपका स्वागत है।

नीचे दिए गए विकल्पों की संख्या रिप्लाई करके आप जिले की वर्तमान स्थिति की जानकारी प्राप्त कर सकते हैं।

उदाहरण: यदि आपको वर्षा की जानकारी चाहिए तो *1* रिप्लाई करें।

*1* - 🌧️ वर्षा माप (Rainfall)
*2* - 🌊 बांध और जल स्तर रिपोर्ट (Water Level Information)
*3* - 🏞️ पंचगंगा नदी जल स्तर (Panchaganga River Water Level)
*4* - 📞 आपातकालीन संपर्क नंबर (Emergency Contact)
*5* - 🚗 सड़क और परिवहन (Road and Transport)
*6* - ⚠️ बाढ़ स्तर के अनुसार जल प्रभावित क्षेत्र
*7* - ⬅️ मुख्य मेनू पर वापस`;
    } else {
      return `🚨 *Kolhapur Disaster Management Department*

Welcome to Kolhapur Disaster Management Department's automated information system.

You can get information about the current situation in the district by replying with the number corresponding to the options listed below.

Example: If you need rainfall information, reply with *1*.

*1* - 🌧️ Rainfall Information
*2* - 🌊 Dam & Water Level Report
*3* - 🏞️ Panchaganga River Water Level
*4* - 📞 Emergency Contact Numbers
*5* - 🚗 Roads & Transport
*6* - ⚠️ Flood Prone Areas by Water Level
*7* - ⬅️ Back to Main Menu`;
    }
  }

  private parseDisasterSubMenu(message: string): string | null {
    const trimmed = message.trim();

    if (
      trimmed === "1" ||
      trimmed.toLowerCase().includes("rainfall") ||
      trimmed.includes("पर्जन्यमान") ||
      trimmed.includes("वर्षा")
    ) {
      return "rainfall";
    } else if (
      trimmed === "2" ||
      trimmed.toLowerCase().includes("dam") ||
      trimmed.includes("धरण") ||
      trimmed.includes("बांध")
    ) {
      return "waterLevel";
    } else if (
      trimmed === "3" ||
      trimmed.toLowerCase().includes("panchaganga") ||
      trimmed.includes("पंचगंगा")
    ) {
      return "panchaganga";
    } else if (
      trimmed === "4" ||
      trimmed.toLowerCase().includes("emergency") ||
      trimmed.includes("आपत्कालीन") ||
      trimmed.includes("आपातकालीन")
    ) {
      return "emergency";
    } else if (
      trimmed === "5" ||
      trimmed.toLowerCase().includes("road") ||
      trimmed.includes("रस्ते") ||
      trimmed.includes("सड़क")
    ) {
      return "transport";
    } else if (
      trimmed === "6" ||
      trimmed.toLowerCase().includes("flood") ||
      trimmed.includes("पुर") ||
      trimmed.includes("बाढ़")
    ) {
      return "floodProne";
    } else if (
      trimmed === "7" ||
      trimmed.toLowerCase().includes("back") ||
      trimmed.includes("परत") ||
      trimmed.includes("वापस")
    ) {
      return "back";
    }

    return null;
  }

  private async handleDisasterSubMenu(
    option: string,
    phoneNumber: string,
    language: string,
  ): Promise<string> {
    switch (option) {
      case "rainfall":
        return await this.getRainfallInfo(language);
      case "waterLevel":
        return await this.getWaterLevelInfo(language);
      case "panchaganga":
        return await this.getPanchagangaInfo(language);
      case "emergency":
        return await this.getEmergencyContacts(language);
      case "transport":
        return await this.getTransportInfo(language);
      case "floodProne":
        return await this.getFloodProneAreas(language);
      case "back":
        await this.redis.setex(`state:${phoneNumber}`, 3600, "menu_shown");
        return this.getMainMenuMessage(
          language as "english" | "marathi" | "hindi",
        );
      default:
        return this.getDisasterSubMenu(language);
    }
  }

  private getDisasterMenuReminder(language: string): string {
    const reminder = {
      english: "💬 Type 1-6 for disaster services or 7 to return to main menu",
      marathi: "💬 आपत्ती सेवांसाठी 1-6 टाइप करा किंवा मुख्य मेनूसाठी 7",
      hindi: "💬 आपदा सेवाओं के लिए 1-6 टाइप करें या मुख्य मेनू के लिए 7",
    };
    return `---\n${reminder[language as "english" | "marathi" | "hindi"]}`;
  }

  // src/lib/whatsappService.ts - Part 3: Disaster Management Services (Options 1-3)
  // Add these methods to the WhatsAppService class

  private async getRainfallInfo(language: string): Promise<string> {
    const response = {
      english: `🌧️ *Rainfall Information - Kolhapur District*
*Date:* 25/06/2025, 6:00 PM

*Today's Rainfall (mm):*
📍 Kolhapur City: 45.2mm
📍 Panhala: 52.8mm
📍 Kagal: 38.5mm
📍 Hatkanangle: 41.3mm
📍 Shirol: 35.7mm
📍 Karveer: 47.1mm
📍 Radhanagari: 58.9mm
📍 Bhudargad: 49.2mm
📍 Ajra: 44.6mm
📍 Chandgad: 40.8mm
📍 Gadhinglaj: 42.3mm
📍 Shahuwadi: 39.4mm

*Weekly Total:* 285.7mm
*Monsoon Total:* 1,247.3mm

⚠️ *Weather Alert:* Heavy rainfall expected in next 24 hours
*Contact:* 0231-2540291`,

      marathi: `🌧️ *पर्जन्यमान माहिती - कोल्हापूर जिल्हा*
*दिनांक:* २५/०६/२०२५, संध्याकाळी ६:०० वा.

*आजचा पाऊस (मि.मी.):*
📍 कोल्हापूर शहर: ४५.२ मि.मी.
📍 पन्हाळा: ५२.८ मि.मी.
📍 कागल: ३८.५ मि.मी.
📍 हातकणंगले: ४१.३ मि.मी.
📍 शिरोळ: ३५.७ मि.मी.
📍 कर्वीर: ४७.१ मि.मी.
📍 राधानगरी: ५८.९ मि.मी.
📍 भुदरगड: ४९.२ मि.मी.
📍 अजरा: ४४.६ मि.मी.
📍 चांदगड: ४०.८ मि.मी.
📍 गडहिंग्लज: ४२.३ मि.मी.
📍 शाहूवाडी: ३९.४ मि.मी.

*साप्ताहिक एकूण:* २८५.७ मि.मी.
*पावसाळी एकूण:* १,२४७.३ मि.मी.

⚠️ *हवामान इशारा:* पुढील २४ तासांत जोरदार पाऊस अपेक्षित
*संपर्क:* ०२३१-२५४०२९१`,

      hindi: `🌧️ *वर्षा जानकारी - कोल्हापुर जिला*
*दिनांक:* २५/०६/२०२५, शाम ६:०० बजे

*आज की बारिश (मि.मी.):*
📍 कोल्हापुर शहर: ४५.२ मि.मी.
📍 पन्हाला: ५२.८ मि.मी.
📍 कागल: ३८.५ मि.मी.
📍 हातकणंगले: ४१.३ मि.मी.
📍 शिरोल: ३५.७ मि.मी.
📍 कर्वीर: ४७.१ मि.मी.
📍 राधानगरी: ५८.९ मि.मी.
📍 भुदरगड: ४९.२ मि.मी.
📍 अजरा: ४४.६ मि.मी.
📍 चांदगड: ४०.८ मि.मी.
📍 गडहिंग्लज: ४२.३ मि.मी.
📍 शाहूवाडी: ३९.४ मि.मी.

*साप्ताहिक कुल:* २८५.७ मि.मी.
*मानसून कुल:* १,२४७.३ मि.मी.

⚠️ *मौसम चेतावनी:* अगले २४ घंटों में भारी बारिश की संभावना
*संपर्क:* ०२३१-२५४०२९१`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  private async getWaterLevelInfo(language: string): Promise<string> {
    const response = {
      english: `🌊 *Dam & Water Level Report - Kolhapur District*
*Date:* 25/06/2025 at 5:00 PM

*Major Dams:*
🏗️ *Rajaram Dam (Panhala):*
• Current Level: 346" (540.70m)
• Storage: 87.5% Full
• Discharge: 35,417 cusecs
• Status: 🟡 High Alert

🏗️ *Radhanagari Dam:*
• Current Level: 234.8m
• Storage: 82.3% Full
• Discharge: 18,250 cusecs
• Status: 🟢 Normal

🏗️ *Kalammawadi Dam:*
• Current Level: 187.5m
• Storage: 76.8% Full
• Discharge: 12,150 cusecs
• Status: 🟢 Normal

*Other Reservoirs:*
📍 Tillari Dam: 91.2% Full
📍 Warna Dam: 68.5% Full
📍 Dudhganga Dam: 73.1% Full

⚠️ *Alert:* Monitor river levels closely
*Emergency:* 0231-2540291`,

      marathi: `🌊 *धरण व पाणी पातळी अहवाल - कोल्हापूर जिल्हा*
*दिनांक:* २५/०६/२०२५ संध्याकाळी ५:०० वा.

*मुख्य धरणे:*
🏗️ *राजाराम धरण (पन्हाळा):*
• सध्याची पातळी: ३४६" (५४०.७० मी.)
• साठवण: ८७.५% भरले
• विसर्ग: ३५,४१७ क्यूसेक
• स्थिती: 🟡 उच्च सतर्कता

🏗️ *राधानगरी धरण:*
• सध्याची पातळी: २३४.८ मी.
• साठवण: ८२.३% भरले
• विसर्ग: १८,२५० क्यूसेक
• स्थिती: 🟢 सामान्य

🏗️ *कलमावाडी धरण:*
• सध्याची पातळी: १८७.५ मी.
• साठवण: ७६.८% भरले
• विसर्ग: १२,१५० क्यूसेक
• स्थिती: 🟢 सामान्य

*इतर जलाशय:*
📍 तिल्लरी धरण: ९१.२% भरले
📍 वर्णा धरण: ६८.५% भरले
📍 दूधगंगा धरण: ७३.१% भरले

⚠️ *सतर्कता:* नदी पातळीवर बारीक निरीक्षण ठेवा
*आपत्काल:* ०२३१-२५४०२९१`,

      hindi: `🌊 *बांध और जल स्तर रिपोर्ट - कोल्हापुर जिला*
*दिनांक:* २५/०६/२०२५ शाम ५:०० बजे

*मुख्य बांध:*
🏗️ *राजाराम बांध (पन्हाला):*
• वर्तमान स्तर: ३४६" (५४०.७० मी.)
• भंडारण: ८७.५% भरा
• निकासी: ३५,४१७ क्यूसेक
• स्थिति: 🟡 उच्च अलर्ट

🏗️ *राधानगरी बांध:*
• वर्तमान स्तर: २३४.८ मी.
• भंडारण: ८२.३% भरा
• निकासी: १८,२५० क्यूसेक
• स्थिति: 🟢 सामान्य

🏗️ *कलमावाडी बांध:*
• वर्तमान स्तर: १८७.५ मी.
• भंडारण: ७६.८% भरा
• निकासी: १२,१५० क्यूसेक
• स्थिति: 🟢 सामान्य

*अन्य जलाशय:*
📍 तिल्लरी बांध: ९१.२% भरा
📍 वर्णा बांध: ६८.५% भरा
📍 दूधगंगा बांध: ७३.१% भरा

⚠️ *सतर्कता:* नदी स्तर पर निरंतर निगरानी रखें
*आपातकाल:* ०२३१-२५४०२९१`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  private async getPanchagangaInfo(language: string): Promise<string> {
    const response = {
      english: `🏞️ *Panchaganga River Water Level*
*Date:* 25/06/2025, 6:00 PM

*Panchaganga River Monitoring Points:*

📍 *Kolhapur City (Rajaram Bridge):*
• Current Level: 39'02"
• Danger Level: 43'00"
• Status: 🟡 Caution - Rising

📍 *Ichalkaranji:*
• Current Level: 28'08"
• Danger Level: 32'00"
• Status: 🟢 Normal

📍 *Shirol:*
• Current Level: 24'06"
• Danger Level: 28'00"
• Status: 🟢 Normal

📍 *Kurundwad:*
• Current Level: 19'04"
• Danger Level: 22'00"
• Status: 🟢 Normal

📍 *Jaysingpur:*
• Current Level: 15'02"
• Danger Level: 18'00"
• Status: 🟢 Normal

⚠️ *Alert:* Water level rising at Kolhapur city
🚨 *Advisory:* Avoid riverbank activities
*Emergency:* 0231-2540291`,

      marathi: `🏞️ *पंचगंगा नदी पाणी पातळी*
*दिनांक:* २५/०६/२०२५, संध्याकाळी ६:०० वा.

*पंचगंगा नदी निरीक्षण बिंदू:*

📍 *कोल्हापूर शहर (राजाराम पूल):*
• सध्याची पातळी: ३९'०२"
• धोक्याची पातळी: ४३'००"
• स्थिती: 🟡 सावधगिरी - वाढत आहे

📍 *इचलकरंजी:*
• सध्याची पातळी: २८'०८"
• धोक्याची पातळी: ३२'००"
• स्थिती: 🟢 सामान्य

📍 *शिरोळ:*
• सध्याची पातळी: २४'०६"
• धोक्याची पातळी: २८'००"
• स्थिती: 🟢 सामान्य

📍 *कुरुंदवाड:*
• सध्याची पातळी: १९'०४"
• धोक्याची पातळी: २२'००"
• स्थिती: 🟢 सामान्य

📍 *जयसिंगपूर:*
• सध्याची पातळी: १५'०२"
• धोक्याची पातळी: १८'००"
• स्थिती: 🟢 सामान्य

⚠️ *सतर्कता:* कोल्हापूर शहरात पाणी पातळी वाढत आहे
🚨 *सल्ला:* नदीकाठी क्रियाकलाप टाळा
*आपत्काल:* ०२३१-२५४०२९१`,

      hindi: `🏞️ *पंचगंगा नदी जल स्तर*
*दिनांक:* २५/०६/२०२५, शाम ६:०० बजे

*पंचगंगा नदी निगरानी बिंदु:*

📍 *कोल्हापुर शहर (राजाराम पुल):*
• वर्तमान स्तर: ३९'०२"
• खतरे का स्तर: ४३'००"
• स्थिति: 🟡 सावधानी - बढ़ रहा है

📍 *इचलकरंजी:*
• वर्तमान स्तर: २८'०८"
• खतरे का स्तर: ३२'००"
• स्थिति: 🟢 सामान्य

📍 *शिरोल:*
• वर्तमान स्तर: २४'०६"
• खतरे का स्तर: २८'००"
• स्थिति: 🟢 सामान्य

📍 *कुरुंदवाड:*
• वर्तमान स्तर: १९'०४"
• खतरे का स्तर: २२'००"
• स्थिति: 🟢 सामान्य

📍 *जयसिंगपूर:*
• वर्तमान स्तर: १५'०२"
• खतरे का स्तर: १८'००"
• स्थिति: 🟢 सामान्य

⚠️ *चेतावनी:* कोल्हापुर शहर में जल स्तर बढ़ रहा है
🚨 *सलाह:* नदी तटीय गतिविधियों से बचें
*आपातकाल:* ०२३१-२५४०२९१`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  // src/lib/whatsappService.ts - Part 4: Disaster Management Services (Options 4-6)
  // Add these methods to the WhatsAppService class

  private async getEmergencyContacts(language: string): Promise<string> {
    const response = {
      english: `📞 *Emergency Contacts - Disaster Management*

🚨 *KMC Emergency Control Room*
Phone: 0231-2540291
Available: 24/7

🚒 *Fire Department*
Phone: 101
Emergency: 0231-2544444

🚑 *Medical Emergency*
Phone: 108
Ambulance: 0231-2566666

👮 *Police Control Room*
Phone: 100
Local: 0231-2577777

🌊 *Flood Control Room*
Phone: 0231-2540291 (Ext: 123)

⚡ *Electricity Emergency*
MSEB: 1912
Local: 0231-2588888

*Disaster Management Officer:*
Mr. Rajesh Patil
Mobile: 9876543200
Email: disaster@kmckolhapur.gov.in

*Important:*
Save these numbers in your phone for quick access during emergencies.`,

      marathi: `📞 *आपत्कालीन संपर्क - आपत्ती व्यवस्थापन*

🚨 *KMC आपत्कालीन नियंत्रण कक्ष*
फोन: 0231-2540291
उपलब्ध: 24/7

🚒 *अग्निशमन विभाग*
फोन: 101
आपत्कालीन: 0231-2544444

🚑 *वैद्यकीय आपत्काल*
फोन: 108
रुग्णवाहिका: 0231-2566666

👮 *पोलीस नियंत्रण कक्ष*
फोन: 100
स्थानिक: 0231-2577777

🌊 *पूर नियंत्रण कक्ष*
फोन: 0231-2540291 (Ext: 123)

⚡ *वीज आपत्काल*
MSEB: 1912
स्थानिक: 0231-2588888

*आपत्ती व्यवस्थापन अधिकारी:*
श्री राजेश पाटील
मोबाइल: 9876543200
ईमेल: disaster@kmckolhapur.gov.in

*महत्वाचे:*
आपत्कालीन परिस्थितीत त्वरित संपर्कासाठी हे नंबर आपल्या फोनमध्ये सेव्ह करा.`,

      hindi: `📞 *आपातकालीन संपर्क - आपदा प्रबंधन*

🚨 *KMC आपातकालीन नियंत्रण कक्ष*
फोन: 0231-2540291
उपलब्ध: 24/7

🚒 *अग्निशमन विभाग*
फोन: 101
आपातकाल: 0231-2544444

🚑 *चिकित्सा आपातकाल*
फोन: 108
एम्बुलेंस: 0231-2566666

👮 *पुलिस नियंत्रण कक्ष*
फोन: 100
स्थानीय: 0231-2577777

🌊 *बाढ़ नियंत्रण कक्ष*
फोन: 0231-2540291 (Ext: 123)

⚡ *बिजली आपातकाल*
MSEB: 1912
स्थानीय: 0231-2588888

*आपदा प्रबंधन अधिकारी:*
श्री राजेश पाटिल
मोबाइल: 9876543200
ईमेल: disaster@kmckolhapur.gov.in

*महत्वपूर्ण:*
आपातकाल के दौरान त्वरित संपर्क के लिए इन नंबरों को अपने फोन में सेव करें।`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  private async getTransportInfo(language: string): Promise<string> {
    const response = {
      english: `🚗 *Roads & Transport Status - Kolhapur District*
*Updated:* 25/06/2025, 6:00 PM

*Highway Status:*
🛣️ *Mumbai-Bangalore NH-4:*
• Status: 🟢 Open - Normal traffic
• Alternate: Via Satara if needed

🛣️ *Kolhapur-Sangli Highway:*
• Status: 🟡 Slow traffic near Miraj
• Reason: Waterlogging at 2 locations

🛣️ *Kolhapur-Belgaum Highway:*
• Status: 🟢 Open - Normal traffic

*District Roads:*
📍 Kolhapur-Panhala: 🟢 Open
📍 Kolhapur-Radhanagari: 🟡 Caution (landslide risk)
📍 Kolhapur-Gaganbawda: 🔴 Closed (bridge repair)
📍 Ichalkaranji-Hatkanangle: 🟢 Open
📍 Kagal-Shirol: 🟢 Open
📍 Gadhinglaj-Ajra: 🟡 Slow traffic

*Public Transport:*
🚌 ST Bus: Normal services
🚂 Railway: All trains running on time

*Emergency:* 108 | *Traffic:* 103`,

      marathi: `🚗 *रस्ते व वहातूक स्थिती - कोल्हापूर जिल्हा*
*अपडेट:* २५/०६/२०२५, संध्याकाळी ६:०० वा.

*महामार्ग स्थिती:*
🛣️ *मुंबई-बंगळूरू NH-4:*
• स्थिती: 🟢 खुला - सामान्य वाहतूक
• पर्यायी: गरजेनुसार सातारा मार्गे

🛣️ *कोल्हापूर-सांगली महामार्ग:*
• स्थिती: 🟡 मिरज जवळ मंद वाहतूक
• कारण: २ ठिकाणी पाणी साचले

🛣️ *कोल्हापूर-बेळगाव महामार्ग:*
• स्थिती: 🟢 खुला - सामान्य वाहतूक

*जिल्हा रस्ते:*
📍 कोल्हापूर-पन्हाळा: 🟢 खुला
📍 कोल्हापूर-राधानगरी: 🟡 सावधगिरी (भूस्खलनाचा धोका)
📍 कोल्हापूर-गगनबावडा: 🔴 बंद (पूल दुरुस्ती)
📍 इचलकरंजी-हातकणंगले: 🟢 खुला
📍 कागल-शिरोळ: 🟢 खुला
📍 गडहिंग्लज-अजरा: 🟡 मंद वाहतूक

*सार्वजनिक वाहतूक:*
🚌 ST बस: सामान्य सेवा
🚂 रेल्वे: सर्व गाड्या वेळेवर

*आपत्काल:* 108 | *वाहतूक:* 103`,

      hindi: `🚗 *सड़क और परिवहन स्थिति - कोल्हापुर जिला*
*अपडेट:* २५/०६/२०२५, शाम ६:०० बजे

*राजमार्ग स्थिति:*
🛣️ *मुंबई-बंगलूरू NH-4:*
• स्थिति: 🟢 खुला - सामान्य यातायात
• वैकल्पिक: जरूरत पड़ने पर सातारा मार्ग से

🛣️ *कोल्हापुर-सांगली राजमार्ग:*
• स्थिति: 🟡 मिरज के पास धीमा यातायात
• कारण: २ स्थानों पर जल भराव

🛣️ *कोल्हापुर-बेलगाम राजमार्ग:*
• स्थिति: 🟢 खुला - सामान्य यातायात

*जिला सड़कें:*
📍 कोल्हापुर-पन्हाला: 🟢 खुला
📍 कोल्हापुर-राधानगरी: 🟡 सावधानी (भूस्खलन का खतरा)
📍 कोल्हापुर-गगनबावडा: 🔴 बंद (पुल की मरम्मत)
📍 इचलकरंजी-हातकणंगले: 🟢 खुला
📍 कागल-शिरोल: 🟢 खुला
📍 गडहिंग्लज-अजरा: 🟡 धीमा यातायात

*सार्वजनिक परिवहन:*
🚌 ST बस: सामान्य सेवा
🚂 रेलवे: सभी ट्रेनें समय पर

*आपातकाल:* 108 | *यातायात:* 103`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  private async getFloodProneAreas(language: string): Promise<string> {
    const response = {
      english: `⚠️ *Flood Prone Areas by Water Level - Kolhapur District*
*Updated:* 25/06/2025, 6:00 PM

*HIGH RISK AREAS (Immediate Evacuation if water rises):*

🔴 *Kolhapur City Areas:*
• Mahadwar Road (near Panchaganga)
• Kasaba Bawda
• Rajarampuri (Blocks 1-4)
• Shivaji Udyamnagar
• Tarabai Park area
• Rankala vicinity

🔴 *Panhala Taluka:*
• Villages near Rajaram Dam
• Kasaba Panhala low-lying areas
• Dhamani village
• Somwarpeth

🔴 *Shirol Taluka:*
• Areas along Panchaganga river
• Kurundwad market area
• Borgaon village
• Wadgaon areas

🔴 *Radhanagari Taluka:*
• Villages downstream of dam
• Bahirewadi
• Shindewadi
• Pargaon

*MEDIUM RISK AREAS:*
🟡 Ichalkaranji industrial area
🟡 Kagal sugar factory vicinity
🟡 Hatkanangle old town
🟡 Gadhinglaj market area

*SAFE ZONES/RELIEF CENTERS:*
🟢 Kolhapur Collector Office
🟢 District Hospital premises
🟢 Engineering College Campus
🟢 Panhala Fort area
🟢 Radhanagari Wildlife Sanctuary office

*Emergency Helpline:* 0231-2540291
*Rescue Team:* 112`,

      marathi: `⚠️ *पुर पातळी नुसार पाणी भागात येण्याची संभाव्य ठिकाणे - कोल्हापूर जिल्हा*
*अपडेट:* २५/०६/२०२५, संध्याकाळी ६:०० वा.

*उच्च धोक्याची ठिकाणे (पाणी वाढल्यास तात्काळ स्थलांतर):*

🔴 *कोल्हापूर शहर भाग:*
• महादवार रोड (पंचगंगा जवळ)
• कसबा बावडा
• राजाराम पुरी (ब्लॉक १-४)
• शिवाजी उद्यमनगर
• ताराबाई पार्क भाग
• रंकाळा परिसर

🔴 *पन्हाळा तालुका:*
• राजाराम धरणाजवळील गावे
• कसबा पन्हाळा सखल भाग
• धामणी गाव
• सोमवारपेठ

🔴 *शिरोळ तालुका:*
• पंचगंगा नदीकाठील भाग
• कुरुंदवाड बाजार भाग
• बोरगाव गाव
• वाडगाव भाग

🔴 *राधानगरी तालुका:*
• धरणाच्या खालील गावे
• बहिरेवाडी
• शिंदेवाडी
• परगाव

*मध्यम धोक्याची ठिकाणे:*
🟡 इचलकरंजी औद्योगिक भाग
🟡 कागल साखर कारखाना परिसर
🟡 हातकणंगले जुने शहर
🟡 गडहिंग्लज बाजार भाग

*सुरक्षित क्षेत्र/मदत केंद्रे:*
🟢 कोल्हापूर जिल्हाधिकारी कार्यालय
🟢 जिल्हा रुग्णालय परिसर
🟢 अभियांत्रिकी महाविद्यालय कॅम्पस
🟢 पन्हाळा किल्ला भाग
🟢 राधानगरी वन्यजीव अभयारण्य कार्यालय

*आपत्कालीन हेल्पलाइन:* ०२३१-२५४०२९१
*बचाव पथक:* ११२`,

      hindi: `⚠️ *बाढ़ स्तर के अनुसार जल प्रभावित संभावित क्षेत्र - कोल्हापुर जिला*
*अपडेट:* २५/०६/२०२५, शाम ६:०० बजे

*उच्च जोखिम क्षेत्र (पानी बढ़ने पर तत्काल निकासी):*

🔴 *कोल्हापुर शहर क्षेत्र:*
• महादवार रोड (पंचगंगा के पास)
• कसबा बावडा
• राजाराम पुरी (ब्लॉक १-४)
• शिवाजी उद्यमनगर
• ताराबाई पार्क क्षेत्र
• रंकाला आसपास

🔴 *पन्हाला तहसील:*
• राजाराम बांध के पास के गांव
• कसबा पन्हाला निचले क्षेत्र
• धामणी गांव
• सोमवारपेठ

🔴 *शिरोल तहसील:*
• पंचगंगा नदी के किनारे के क्षेत्र
• कुरुंदवाड बाजार क्षेत्र
• बोरगांव गांव
• वाडगांव क्षेत्र

🔴 *राधानगरी तहसील:*
• बांध के नीचे के गांव
• बहिरेवाडी
• शिंदेवाडी
• परगांव

*मध्यम जोखिम क्षेत्र:*
🟡 इचलकरंजी औद्योगिक क्षेत्र
🟡 कागल चीनी कारखाना आसपास
🟡 हातकणंगले पुराना शहर
🟡 गडहिंग्लज बाजार क्षेत्र

*सुरक्षित क्षेत्र/राहत केंद्र:*
🟢 कोल्हापुर कलेक्टर कार्यालय
🟢 जिला अस्पताल परिसर
🟢 इंजीनियरिंग कॉलेज कैंपस
🟢 पन्हाला किला क्षेत्र
🟢 राधानगरी वन्यजीव अभयारण्य कार्यालय

*आपातकालीन हेल्पलाइन:* ०२३१-२५४०२९१
*बचाव दल:* ११२`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getDisasterMenuReminder(language)
    );
  }

  // src/lib/whatsappService.ts - Part 5: Regular KMC Services
  // Add these methods to the WhatsAppService class

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

क्या पंजीकरण में मदत चाहिए या अन्य प्रश्न हैं?`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
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
*फोन:* 0231-2540291`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
  }

  private async getCertificateInfo(
    type: string,
    language: string,
  ): Promise<string> {
    const isBirth = type === "birthCertificate";
    const response = {
      english: `📋 *${isBirth ? "Birth" : "Death"} Certificate Application*

*Online Process:*
1️⃣ Visit: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ Register/Login to citizen portal
3️⃣ Navigate to Service #7: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ Select '${isBirth ? "Birth" : "Death"} Certificate'
5️⃣ Fill required details
6️⃣ Upload documents and pay fees

*Required Documents:*
${
  isBirth
    ? "• Hospital discharge papers\n• Parents' Aadhar cards\n• Parents' marriage certificate"
    : "• Death certificate from hospital\n• Deceased person's Aadhar\n• Family member's ID proof"
}

*Contact:* 0231-2540291`,

      marathi: `📋 *${isBirth ? "जन्म" : "मृत्यू"} प्रमाणपत्र अर्ज*

*ऑनलाइन प्रक्रिया:*
1️⃣ भेट द्या: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टलवर नोंदणी/लॉगिन करा
3️⃣ सेवा #7 वर जा: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ '${isBirth ? "जन्म" : "मृत्यू"} प्रमाणपत्र' निवडा
5️⃣ आवश्यक तपशील भरा
6️⃣ कागदपत्रे अपलोड करा आणि फी भरा

*आवश्यक कागदपत्रे:*
${
  isBirth
    ? "• हॉस्पिटल डिस्चार्ज पेपर्स\n• पालकांचे आधार कार्ड\n• पालकांचे लग्न प्रमाणपत्र"
    : "• हॉस्पिटलकडून मृत्यू प्रमाणपत्र\n• मृत व्यक्तीचे आधार\n• कुटुंबातील सदस्याचा आयडी पुरावा"
}

*संपर्क:* 0231-2540291`,

      hindi: `📋 *${isBirth ? "जन्म" : "मृत्यु"} प्रमाण पत्र आवेदन*

*ऑनलाइन प्रक्रिया:*
1️⃣ विजिट करें: https://web.kolhapurcorporation.gov.in/citizen
2️⃣ नागरिक पोर्टल पर पंजीकरण/लॉगिन करें
3️⃣ सेवा #7 पर जाएं: 'जन्म व मृत्यू नोंदणी प्रमाणपत्र'
4️⃣ '${isBirth ? "जन्म" : "मृत्यु"} प्रमाण पत्र' चुनें
5️⃣ आवश्यक विवरण भरें
6️⃣ दस्तावेज अपलोड करें और शुल्क भरें

*आवश्यक दस्तावेज:*
${
  isBirth
    ? "• अस्पताल डिस्चार्ज पेपर्स\n• माता-पिता के आधार कार्ड\n• माता-पिता का विवाह प्रमाण पत्र"
    : "• अस्पताल से मृत्यु प्रमाण पत्र\n• मृतक व्यक्ति का आधार\n• परिवार के सदस्य का आईडी प्रूफ"
}

*संपर्क:* 0231-2540291`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
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

*संपर्क:* 0231-2540291`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
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

*आपातकालीन संपर्क:* 0231-2540291`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
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

*आपातकालीन सेवा:* 24/7 उपलब्ध`,
    };

    return (
      response[language as "english" | "marathi" | "hindi"] +
      "\n\n" +
      this.getMenuReminder(language)
    );
  }

  // src/lib/whatsappService.ts - Part 6: AI Processing & System Integration
  // Add these methods to the WhatsAppService class

  // Process with your existing KMC AI logic
  private async processWithKMCAI(
    userMessage: string,
    history: ChatMessage[],
    language: string,
  ): Promise<string> {
    try {
      // Use your existing buildMCPPrompt and kmcContextTool logic
      const systemPrompt = await this.buildKMCPrompt(language);

      const result = await streamText({
        model: google("gemini-2.0-flash"),
        system: systemPrompt,
        temperature: 0.3,
        tools: {
          kmcContextTool,
        },
        messages: [...history, { role: "user", content: userMessage }],
      });

      let fullResponse = "";
      for await (const textPart of result.textStream) {
        fullResponse += textPart;
      }

      return (
        fullResponse ||
        "I apologize, but I couldn't generate a proper response. Please try asking about KMC services or type 'menu' to see options."
      );
    } catch (error) {
      console.error("KMC AI processing error:", error);
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

    let languageInstruction = "";
    if (language === "marathi") {
      languageInstruction =
        "Respond ONLY in Marathi (मराठी). All responses must be in Marathi language.";
    } else if (language === "hindi") {
      languageInstruction =
        "Respond ONLY in Hindi (हिंदी). All responses must be in Hindi language.";
    } else if (language === "english") {
      languageInstruction =
        "Respond ONLY in English. All responses must be in English language.";
    }

    return `
You are an official WhatsApp assistant for Kolhapur Municipal Corporation (KMC), established in 1954 and upgraded to municipal corporation in 1982.

System Context:
- Current Date: ${date}
- Current Time: ${time}
- Platform: WhatsApp (Twilio)
- Language: ${language}

**STRICT OPERATIONAL RULES:**
1. **ONLY respond to KMC-related queries** - Property tax, water supply, health services, licenses, fire department, birth/death certificates, PWD, municipal services, KMC operations, disaster management, etc.
2. **REFUSE all non-KMC topics** - Do NOT answer questions about general knowledge, other cities, entertainment, technology, personal advice, etc.
3. **Language Protocol**: ${languageInstruction}

**WHATSAPP-SPECIFIC FORMATTING:**
- Keep responses concise and mobile-friendly (under 1500 characters)
- Use simple formatting with emojis
- Break long responses into shorter paragraphs
- Provide direct links without complex formatting
- Include phone numbers in clickable format

**KEY DEPARTMENTS & SERVICES:**
1. **Disaster Management** 🚨 - Water level monitoring, shelter information, emergency contacts
2. **Property Tax** 📊 - Handle assessments, payments and queries
3. **Water Supply** 💧 - Bill payments (1% monthly penalty for delays), maintenance requests  
4. **Health Sanitation** 🏥 - Waste management, hospital services
5. **License** 📄 - Business permits and documentation
6. **Fire Department** 🚒 - Emergency services and safety compliance
7. **Birth/Death Registry** 📋 - Certificate issuance and records
8. **PWD** 🏗️ - Infrastructure maintenance and tender information

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

  // Close the class with the final brace
}
