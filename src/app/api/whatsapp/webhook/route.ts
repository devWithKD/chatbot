// src/app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppService } from '@/lib/whatsappService';

// Initialize WhatsApp service
const whatsappService = new WhatsAppService(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const from = formData.get('From') as string;
        const body = formData.get('Body') as string;
        const profileName = formData.get('ProfileName') as string;

        if (!from || !body) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`📱 WhatsApp message from ${profileName || from}: ${body}`);

        const phoneNumber = from.replace('whatsapp:', '');

        // Check for commands first
        const commandResponse = await whatsappService.handleCommand(body, phoneNumber);

        let responseMessage: string;
        if (commandResponse) {
            responseMessage = commandResponse;
        } else {
            // Process with KMC AI
            responseMessage = await whatsappService.handleIncomingMessage(from, body);
        }

        // Send response back via WhatsApp
        await whatsappService.sendMessage(from, responseMessage);

        // Respond to Twilio webhook
        return NextResponse.json({ status: 'success' });
    } catch (error) {
        console.error('❌ WhatsApp webhook error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'KMC WhatsApp webhook is running',
        timestamp: new Date().toISOString(),
        service: 'Kolhapur Municipal Corporation'
    });
}