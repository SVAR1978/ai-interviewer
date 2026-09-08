import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { config } from '../config/env';

export interface TTSResult {
  audioBase64?: string;
  format: string;
  provider: 'azure' | 'browser_fallback';
  voice?: string;
}

class TTSService {
  public isAzureConfigured(): boolean {
    return Boolean(config.azureSpeechKey && config.azureSpeechKey.trim().length > 0);
  }

  /**
   * Generates enterprise-grade voice audio for a given question using Microsoft Azure AI Speech.
   * Synthesizes audio entirely in-memory (bypassing server audio hardware) and returns an MP3 buffer.
   */
  public async generateSpeech(text: string, voiceName?: string): Promise<TTSResult> {
    if (!this.isAzureConfigured()) {
      console.log('[TTSService] AZURE_SPEECH_KEY not found. Operating with client fallback.');
      return {
        provider: 'browser_fallback',
        format: 'audio/mp3',
      };
    }

    const activeVoice = voiceName || config.azureSpeechVoice || 'en-US-JennyNeural';

    return new Promise<TTSResult>((resolve) => {
      try {
        const speechConfig = sdk.SpeechConfig.fromSubscription(
          config.azureSpeechKey,
          config.azureSpeechRegion
        );

        // Standard MP3 format compatible with all browser Audio APIs
        speechConfig.speechSynthesisOutputFormat =
          sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
        speechConfig.speechSynthesisVoiceName = activeVoice;

        // Passing null as the second argument forces in-memory buffer output (no server speakers needed)
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as any);

        synthesizer.speakTextAsync(
          text,
          (result) => {
            try {
              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                const audioBuffer = Buffer.from(result.audioData);
                const audioBase64 = audioBuffer.toString('base64');
                synthesizer.close();

                resolve({
                  audioBase64,
                  format: 'audio/mp3',
                  provider: 'azure',
                  voice: activeVoice,
                });
              } else {
                const cancellation = sdk.CancellationDetails.fromResult(result);
                console.warn('[TTSService] Azure Speech canceled/failed:', cancellation.errorDetails);
                synthesizer.close();

                resolve({
                  provider: 'browser_fallback',
                  format: 'audio/mp3',
                });
              }
            } catch (err: any) {
              console.warn('[TTSService] Error processing Azure Speech result:', err);
              synthesizer.close();
              resolve({ provider: 'browser_fallback', format: 'audio/mp3' });
            }
          },
          (err) => {
            console.warn('[TTSService] Azure Speech error:', err);
            synthesizer.close();
            resolve({
              provider: 'browser_fallback',
              format: 'audio/mp3',
            });
          }
        );
      } catch (initErr: any) {
        console.error('[TTSService] Failed to initialize Azure Speech Synthesizer:', initErr);
        resolve({
          provider: 'browser_fallback',
          format: 'audio/mp3',
        });
      }
    });
  }
}

export const ttsService = new TTSService();
