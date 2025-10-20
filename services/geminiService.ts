import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const systemInstruction = `You are an expert cybersecurity analyst specializing in email threat detection. Your task is to analyze email content, which may be provided as text and/or an image, and determine if it is spam, a phishing attempt, or a legitimate email. 
Provide a clear boolean verdict, a confidence score from 0-100, a concise explanation, and a list of specific red flags.
Additionally, provide a detailed analysis on the following, if information is available in the email headers, content or image:
1.  **Sender Reputation**: Based on the 'From' address and name, assess the sender's likely reputation. Note if it appears to be impersonating a known brand or individual.
2.  **Domain Analysis**: Analyze the domain of the sender's email address. Comment on its likely age, legitimacy, or if it's a lookalike domain. If no specific information is available, state that.
3.  **Link Analysis**: Identify all hyperlinks in the email body. For each link, provide the full URL and a summary of its potential risk (e.g., "URL leads to a known malicious domain," "URL is a redirect," "URL appears safe but mismatched from display text"). If no links are present, return an empty array.`;


const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    isSpam: {
      type: Type.BOOLEAN,
      description: 'True if the email is considered spam or phishing, false otherwise.'
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: 'A score from 0 to 100 representing the confidence in the isSpam verdict.'
    },
    explanation: {
      type: Type.STRING,
      description: 'A brief, clear explanation of the reasoning behind the verdict.'
    },
    redFlags: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: 'A list of specific suspicious elements or tactics identified in the email.'
    },
    senderReputation: {
      type: Type.STRING,
      description: "An assessment of the sender's reputation based on the 'From' field. E.g., 'Suspicious', 'Appears Legitimate', 'Impersonating Brand X'."
    },
    domainAnalysis: {
        type: Type.STRING,
        description: "An analysis of the sender's domain, noting any signs of being recently created, a lookalike, or suspicious."
    },
    linkAnalysis: {
        type: Type.ARRAY,
        description: "A list of all hyperlinks found in the email and a summary of their potential risk.",
        items: {
            type: Type.OBJECT,
            properties: {
                url: {
                    type: Type.STRING,
                    description: "The full URL of the link found."
                },
                summary: {
                    type: Type.STRING,
                    description: "A summary of the potential risk associated with this URL."
                }
            },
            required: ['url', 'summary']
        }
    }
  },
  required: ['isSpam', 'confidenceScore', 'explanation', 'redFlags', 'senderReputation', 'domainAnalysis', 'linkAnalysis'],
};

export const analyzeEmail = async (
  emailContent: string, 
  image?: { base64: string, mimeType: string }
): Promise<AnalysisResult> => {
  try {
    const parts: any[] = [];
    if (image) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64
        }
      });
    }
    if (emailContent) {
      parts.push({
        text: `Please analyze the following email content and provide a threat assessment.\n\n---EMAIL TEXT START---\n${emailContent}\n---EMAIL TEXT END---`
      });
    } else {
       parts.push({
        text: `Please analyze the email in the image and provide a threat assessment.`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      }
    });

    const jsonText = response.text.trim();
    const cleanedJson = jsonText.replace(/^```json\s*|```$/g, '');
    return JSON.parse(cleanedJson);

  } catch (error) {
    console.error("Error analyzing email:", error);
    throw new Error("The AI failed to analyze the email. The content may be too complex or the service may be temporarily unavailable.");
  }
};

export const generateSpeech = async (textToSpeak: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: textToSpeak }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from the API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("The AI failed to generate audio. Please try again later.");
  }
};

export const draftReply = async (emailContent: string): Promise<string> => {
  try {
    const prompt = `Based on the following email, draft a professional and concise reply. Keep the tone appropriate to the original email's context.

--- ORIGINAL EMAIL ---
${emailContent}
--- END OF EMAIL ---

DRAFTED REPLY:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error drafting reply:", error);
    throw new Error("The AI failed to draft a reply. Please try again.");
  }
};
