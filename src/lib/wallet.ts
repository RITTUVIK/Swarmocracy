import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function generateKeypair() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
  };
}

export function keypairFromSecret(secretKey: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretKey));
}
