import { DigiSigner } from "@elumixor/digisigner";
import { env } from "env";
import { SignatureBoxExtractor } from "services/signature-placement";
import { defineTool } from "streaming-agent";
import { z } from "zod";

const digiSigner = new DigiSigner(env.DIGISIGNER_API_KEY);

export const sendForSignatureTool = defineTool(
  "SendForSignature",
  "Send PDF for electronic sign. Returns a link that can be used for signing",
  z.object({
    pdf_base64: z.string().describe("The PDF file as base64-encoded string"),
    filename: z.string().describe("The filename for the document"),
    email: z.email().describe("Signer's email address"),
    name: z.string().describe("Signer's full name"),
    subject: z.string().nullable().describe("Email subject line"),
    message: z.string().nullable().describe("Email message body"),
  }),
  async ({ pdf_base64, filename, email, name, subject, message }, _context) => {
    const buffer = Buffer.from(pdf_base64, "base64");

    const extractor = new SignatureBoxExtractor(buffer);
    const signatureBox = await extractor.getBox(name, email);
    const uploadResult = await digiSigner.uploadDocument(buffer, filename);

    const signers = [{ email, name }];
    const fields = [signatureBox].map((box) => ({
      type: "signature" as const,
      page: box.page,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      signer_id: 0,
      required: true,
    }));

    const signatureResult = await digiSigner.sendSignatureRequest({
      documentId: uploadResult.document_id,
      signers,
      fields,
      subject: subject ?? `Please sign: ${filename}`,
      message: message ?? "Please review and sign the document.",
    });

    return {
      signature_request_id: signatureResult.signature_request_id,
      document_id: uploadResult.document_id,
      signing_urls: signatureResult.signing_urls,
      status: signatureResult.status,
      signers_count: 1,
    };
  },
);
