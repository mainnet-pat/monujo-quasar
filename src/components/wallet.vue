<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { defineCustomElements } from '@bitjson/qr-code';
  import { useStore } from '../stores/store'
  import { useSettingsStore } from '../stores/settingsStore'
  import { useQuasar } from 'quasar'
  const $q = useQuasar()
  const store = useStore()
  const settingsStore = useSettingsStore()

  const xmrDisplayUnit = computed(() => {
    if(store.network == "mainnet") return settingsStore.xmrUnit == "xmr"? " XMR" : " pico"
    else return settingsStore.xmrUnit == "xmr"? " tXMR" : " tpico"
  })
  const displayUnitLong = computed(() => {
    if(store.network == "mainnet") return settingsStore.xmrUnit == "xmr"? " XMR" : " piconero"
    else return settingsStore.xmrUnit == "xmr"? " tXMR" : " testnet piconero"
  })

  defineCustomElements(window);

  // reactive state
  const xmrSendAmount = ref(undefined as (number | undefined));
  const usdSendAmount = ref(undefined as (number | undefined));
  const destinationAddr = ref("");

  function convert(amount: number, unit1: string, unit2: string): number {
    if (unit1 === "usd") {
      const multiplier = unit2 === "piconero" ? 1e12 : 1;

      return Math.round(1e12 * amount / store.exchangeRate! * multiplier) / 1e12;
    }

    if (unit2 === "usd") {
      const multiplier = unit1 === "piconero" ? 1e12 : 1;
      return Math.round(100 * amount * store.exchangeRate! / multiplier) / 100;
    }

    return 0;
  }

  function copyToClipboard(item: string|undefined){
    if(item) navigator.clipboard.writeText(item);
  }
  async function parseAddrParams(){
    const addressInput = destinationAddr.value;
    if(addressInput.includes("?amount=")){
      const [address, params] = addressInput.split("?");
      destinationAddr.value = address;
      // set the xmr amount field
      let xmrAmount =  Number(params.split("amount=")[1]);
      if(settingsStore.xmrUnit == "piconero") xmrAmount = Math.round(xmrAmount * 1e12);
      xmrSendAmount.value = xmrAmount;
      setUsdAmount()
    }
  }
  async function setUsdAmount() {
    if(typeof xmrSendAmount.value != 'number'){
      usdSendAmount.value = undefined
      return
    }
    const newUsdValue = await convert(xmrSendAmount.value, settingsStore.xmrUnit, "usd");
    usdSendAmount.value = Number(newUsdValue.toFixed(2));
  }
  async function setXmrAmount() {
    if(typeof usdSendAmount.value != 'number'){
      xmrSendAmount.value = undefined
      return
    }
    const newXmrValue = await convert(usdSendAmount.value, "usd", settingsStore.xmrUnit);
    xmrSendAmount.value = Number(newXmrValue);
  }
  async function useMaxXmrAmount(){
    if(store.unlockedBalance){
      xmrSendAmount.value = settingsStore.xmrUnit === "xmr" ? Number(store.unlockedBalance.xmr) : Number(store.unlockedBalance.piconero);
      setUsdAmount()
    }
    else{
      $q.notify({
        message: "Wallet doesn't hold any Bitcoin Cash",
        icon: 'warning',
        color: "grey-7"
      })
    }
  }
  async function sendXmr(){
    try{
      if(!store.wallet) return;
      // check for valid inputs
      if(!destinationAddr.value) throw("No destination address provided")
      if(!xmrSendAmount.value) throw("No valid amount provided")
      if(xmrSendAmount.value > (store.unlockedBalance?.piconero ?? 0)) throw("Not enough XMR in wallet")
      const amount = settingsStore.xmrUnit === "piconero" ? BigInt(Math.round(xmrSendAmount.value)) : BigInt(Math.round(xmrSendAmount.value * 1e12));
      const { hash: txId } = await store.wallet?.createTx({
          address: destinationAddr.value,
          amount: amount,
          accountIndex: 0,
          relay: true,
      });
      await store.wallet?.sync();
      await store.wallet?.save();
      alert(`Sent ${xmrSendAmount.value} ${displayUnitLong.value} to ${destinationAddr.value} \n${store.explorerUrl}/tx/${txId}`);
      console.log(`Sent ${xmrSendAmount.value} ${displayUnitLong.value} to ${destinationAddr.value} \n${store.explorerUrl}/tx/${txId}`);
      xmrSendAmount.value = undefined;
      destinationAddr.value = "";
    } catch (error: any) {
      const message = typeof error == 'string' ? error : error.message;
      $q.notify({
        message: message,
        icon: 'warning',
        color: "red"
      })
    }
  }

  async function sweep(){
    try{
      if(!store.wallet) return;
      // check for valid inputs
      if(!destinationAddr.value) throw("No destination address provided")
      const txs = await store.wallet?.sweepUnlocked({
          address: destinationAddr.value,
          relay: true,
      });
      await store.wallet?.sync();
      await store.wallet?.save();
      const total = txs.reduce((acc, tx) => acc + Number(tx.getOutgoingAmount()), 0);
      const totalInUnits = settingsStore.xmrUnit === "piconero" ? total : total / 1e12;
      alert(`Sent ${totalInUnits} ${displayUnitLong.value} to ${destinationAddr.value}`);
      console.log(`Sent ${totalInUnits} ${displayUnitLong.value} to ${destinationAddr.value}`);
      xmrSendAmount.value = undefined;
      destinationAddr.value = "";
    } catch (error: any) {
      console.log(error);
      const message = typeof error == 'string' ? error : error.message;
      $q.notify({
        message: message,
        icon: 'warning',
        color: "red"
      })
    }
  }
</script>


<template>
  <fieldset style="margin-top: 20px; padding-top: 2rem; max-width: 75rem; margin: auto 10px;">
    <div v-if="store.network == 'mainnet'" style="font-size: 1.2em">
      USD balance:
      <span class="primaryColor">
        {{ store.balance && store.balance.usd != undefined ?  (store.balance.usd).toFixed(2) + " $": "" }}
      </span>
    </div>
    <div>
      <span>
        XMR balance:
        <span class="primaryColor">
          {{ store.balance && store.balance[settingsStore.xmrUnit] != undefined ? store.balance[settingsStore.xmrUnit] + displayUnitLong : "" }}
        </span>
      </span>
    </div>
    <div>
      <span v-if="store.balance?.piconero !== store.unlockedBalance?.piconero">
        XMR unlocked balance:
        <span class="primaryColor">
          {{ store.unlockedBalance && store.unlockedBalance[settingsStore.xmrUnit] != undefined ? store.unlockedBalance[settingsStore.xmrUnit] + displayUnitLong : "" }}
        </span>
      </span>
    </div>
    <div style="word-break: break-all;">
      XMR address:
      <span class="depositAddr">{{ store.walletAddress ?? "" }} </span>
      <img class="copyIcon" src="images/copyGrey.svg" @click="() => copyToClipboard(store.walletAddress)">
    </div>
    <qr-code id="qrCode" :contents="store.walletAddress"
      style="display: block; width: 230px; height: 230px; margin: 5px auto 0 auto; background-color: #fff;">
      <img :src="'images/xmr-icon.png'" slot="icon" /> <!-- eslint-disable-line -->
    </qr-code>
    <div style="margin-top: 5px;">
      Send XMR:
      <input v-model="destinationAddr" @input="parseAddrParams()" id="destinationAddr" placeholder="address">
      <span class="sendAmountGroup">
        <span style="position: relative; width: 50%;">
          <input v-model="xmrSendAmount" @input="setUsdAmount()" id="sendAmount" type="number" placeholder="amount">
          <i class="input-icon" style="color: black;">{{ xmrDisplayUnit }}</i>
        </span>
        <span class="sendUsdInput">
          <input v-model="usdSendAmount" @input="setXmrAmount()" id="sendAmount" type="number" placeholder="amount">
          <i class="input-icon" style="color: black;">{{store.network == "mainnet"? "USD $":"tUsd $"}}</i>
        </span>
            <button @click="useMaxXmrAmount()" class="fillInMaxValue">max</button>
      </span>
      <div v-if="(store.unlockedBalance?.[settingsStore.xmrUnit] ?? 0) < (xmrSendAmount ?? 0)" style="color: red;" id="warningNoValue">Not enough XMR in wallet to send</div>

    </div>
    <div style="display: flex;">
      <input @click="sendXmr()" type="button" class="primaryButton" id="send" value="Send" style="margin-top: 8px;">
      <input @click="sweep()" type="button" class="primaryButton" id="send" value="Send All" style="margin-top: 8px; margin-left: 15px;">
      <div style="display: flex; align-items: center; margin-left: auto;" class="primaryColor">
        <span style="text-align: right; white-space: wrap;">{{ store.syncStatus }}</span>
      </div>
    </div>
  </fieldset>
</template>
