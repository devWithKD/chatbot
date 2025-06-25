import { tool } from "ai";
import { z } from "zod";

// Type definitions for KMC Context
interface StepByStepProcess {
    title: string;
    steps: string[];
    documents: string[];
}

interface NewConnectionProcess {
    title: string;
    steps: string[];
}

interface WaterSupplyDepartment {
    name: string;
    head: string;
    services: string[];
    penalty: string;
    portalLink: string;
    departmentLink: string;
    stepByStepProcess: StepByStepProcess & {
        newConnection: NewConnectionProcess;
    };
}

interface PropertyTaxDepartment {
    name: string;
    services: string[];
    portalLink: string;
    contact: string;
    stepByStepProcess: StepByStepProcess;
}

interface BirthDeathDepartment {
    name: string;
    services: string[];
    portalLink: string;
    stepByStepProcess: StepByStepProcess;
}

interface LicenseDepartment {
    name: string;
    services: string[];
    portalLink: string;
    stepByStepProcess: StepByStepProcess;
}

interface ShelterInfo {
    name: string;
    totalCapacity: number;
    currentOccupancy: number;
    availableVacancy: number;
    status: 'ACTIVE' | 'NEARLY_FULL' | 'FULL' | 'CLOSED';
    contact: string;
    address: string;
}

interface WaterLevelInfo {
    date: string;
    time: string;
    rajaram_dam: string;
    discharge: string;
    river_levels: string;
    location: string;
    alert_status: string;
}

interface EmergencyContact {
    department: string;
    phone: string;
    secondary?: string;
    availability: string;
}

interface DisasterManagementDepartment {
    name: string;
    services: string[];
    officer: {
        name: string;
        mobile: string;
        email: string;
    };
    waterLevelInfo: WaterLevelInfo;
    shelters: ShelterInfo[];
    emergencyContacts: EmergencyContact[];
    safetyGuidelines: string[];
}

interface CommonService {
    service: string;
    link: string;
    process: string;
}

interface CitizenRegistration {
    title: string;
    steps: string[];
}

interface GeneralProcess {
    citizenRegistration: CitizenRegistration;
    commonServices: CommonService[];
}

interface PaymentInfo {
    note: string;
    securePayment: string;
}

interface Departments {
    disasterManagement: DisasterManagementDepartment;
    propertyTax: PropertyTaxDepartment;
    waterSupply: WaterSupplyDepartment;
    birthDeath: BirthDeathDepartment;
    license: LicenseDepartment;
}

interface KMCContext {
    departments: Departments;
    generalProcess: GeneralProcess;
    paymentInfo: PaymentInfo;
}

// KMC Context Database with Step-by-Step Processes including Disaster Management
export const KMC_CONTEXT: KMCContext = {
    departments: {
        disasterManagement: {
            name: "Disaster Management Department",
            services: ["Water level monitoring", "Emergency shelter management", "Emergency response coordination", "Public safety alerts"],
            officer: {
                name: "Mr. Rajesh Patil",
                mobile: "9876543200",
                email: "disaster@kmckolhapur.gov.in"
            },
            waterLevelInfo: {
                date: "25/06/2025",
                time: "5:00 PM",
                rajaram_dam: "346\" (540.70m)",
                discharge: "35417 cusecs",
                river_levels: "39'00\" to 43'00\"",
                location: "Panhala-63",
                alert_status: "Monitor water levels closely"
            },
            shelters: [
                {
                    name: "Saraswati Vidyalaya",
                    totalCapacity: 150,
                    currentOccupancy: 45,
                    availableVacancy: 105,
                    status: "ACTIVE",
                    contact: "9876543210",
                    address: "Station Road, Kolhapur"
                },
                {
                    name: "Jan Vidyalaya",
                    totalCapacity: 200,
                    currentOccupancy: 180,
                    availableVacancy: 20,
                    status: "NEARLY_FULL",
                    contact: "9876543211",
                    address: "Near Bus Stand, Kolhapur"
                },
                {
                    name: "Municipal School",
                    totalCapacity: 120,
                    currentOccupancy: 120,
                    availableVacancy: 0,
                    status: "FULL",
                    contact: "9876543212",
                    address: "City Center, Kolhapur"
                }
            ],
            emergencyContacts: [
                {
                    department: "KMC Emergency Control Room",
                    phone: "0231-2540291",
                    availability: "24/7"
                },
                {
                    department: "Fire Department",
                    phone: "101",
                    secondary: "0231-2544444",
                    availability: "24/7"
                },
                {
                    department: "Medical Emergency",
                    phone: "108",
                    secondary: "0231-2566666",
                    availability: "24/7"
                },
                {
                    department: "Police Control Room",
                    phone: "100",
                    secondary: "0231-2577777",
                    availability: "24/7"
                },
                {
                    department: "Flood Control Room",
                    phone: "0231-2540291 (Ext: 123)",
                    availability: "24/7"
                },
                {
                    department: "Electricity Emergency",
                    phone: "1912",
                    secondary: "0231-2588888",
                    availability: "24/7"
                }
            ],
            safetyGuidelines: [
                "Avoid areas near riverbanks during high water levels",
                "Follow evacuation notices if issued by authorities",
                "Keep emergency kit ready with essentials",
                "Stay updated through official KMC channels",
                "Save emergency contact numbers in your phone",
                "Bring valid ID proof when going to shelters",
                "Carry basic medicines and drinking water",
                "Follow instructions from shelter coordinators"
            ]
        },
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

// Define valid category types
type ValidCategory = keyof KMCContext;

// Tool result interface
interface ToolResult {
    error?: string;
    category?: ValidCategory;
    subcategory?: string;
    data?: unknown;
}

// Context access tool
export const kmcContextTool = tool({
    description: "Access specific KMC (Kolhapur Municipal Corporation) information, step-by-step processes, form filling instructions, official portal navigation, and disaster management information",
    parameters: z.object({
        category: z.enum(["departments", "generalProcess", "paymentInfo"])
            .describe("Category of KMC information to retrieve"),
        subcategory: z.string().optional()
            .describe("Specific subcategory within the main category (e.g., 'disasterManagement', 'propertyTax', 'waterSupply', 'citizenRegistration')")
    }),
    execute: async ({ category, subcategory }): Promise<ToolResult> => {
        const categoryData = KMC_CONTEXT[category as ValidCategory];

        if (!categoryData) {
            return { error: "Category not found" };
        }

        if (subcategory && typeof categoryData === 'object' && categoryData !== null) {
            const typedCategoryData = categoryData;

            if (category === "departments" && subcategory in (typedCategoryData as Departments)) {
                return {
                    category: category as ValidCategory,
                    subcategory,
                    data: (typedCategoryData as Departments)[subcategory as keyof Departments]
                };
            }
            if (category === "generalProcess" && subcategory in (typedCategoryData as GeneralProcess)) {
                return {
                    category: category as ValidCategory,
                    subcategory,
                    data: (typedCategoryData as GeneralProcess)[subcategory as keyof GeneralProcess]
                };
            }
            if (category === "paymentInfo" && subcategory in (typedCategoryData as PaymentInfo)) {
                return {
                    category: category as ValidCategory,
                    subcategory,
                    data: (typedCategoryData as PaymentInfo)[subcategory as keyof PaymentInfo]
                };
            }
        }

        return {
            category: category as ValidCategory,
            data: categoryData
        };
    }
});