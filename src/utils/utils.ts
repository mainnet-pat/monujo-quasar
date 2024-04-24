import { hexToBin } from "@bitauth/libauth";

export const getServer = (network: string): string => {
  let server = localStorage.getItem(`server-${network}`);
  if (server) {
    return server;
  }

  switch (network){
    case "mainnet":
      server = "https://monerod.slvit.us:443";
      break;
    case "testnet":
      server = "https://testnet.xmr.ditatompel.com:443";
      break;
    default:
      throw new Error(`Unknown network: ${network}`);
  }

  localStorage.setItem(`server-${network}`, server);
  return server;
}

export const convert = (amount: number, unit1: string, unit2: string, exchangeRate: number): number => {
  if (unit1 === "usd") {
    const multiplier = unit2 === "piconero" ? 1e12 : 1;

    return Math.round(1e12 * amount / exchangeRate * multiplier) / 1e12;
  }

  if (unit2 === "usd") {
    const multiplier = unit1 === "piconero" ? 1e12 : 1;
    return Math.round(100 * amount * exchangeRate / multiplier) / 100;
  }

  return 0;
}

export const parseExtendedJson = (jsonString: string) => {
  const uint8ArrayRegex = /^<Uint8Array: 0x(?<hex>[0-9a-f]*)>$/u;
  const bigIntRegex = /^<bigint: (?<bigint>[0-9]*)n>$/;

  return JSON.parse(jsonString, (_key, value) => {
    if (typeof value === "string") {
      const bigintMatch = value.match(bigIntRegex);
      if (bigintMatch) {
        return BigInt(bigintMatch[1]);
      }
      const uint8ArrayMatch = value.match(uint8ArrayRegex);
      if (uint8ArrayMatch) {
        return hexToBin(uint8ArrayMatch[1]);
      }
    }
    return value;
  });
}

export const stringifyExtendedJson = (obj: any) => {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "bigint") {
      return `<bigint: ${value}n>`;
    }
    if (value instanceof Uint8Array) {
      return `<Uint8Array: 0x${Buffer.from(value).toString("hex")}>`;
    }
    return value;
  });
}
