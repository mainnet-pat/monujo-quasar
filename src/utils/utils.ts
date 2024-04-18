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
