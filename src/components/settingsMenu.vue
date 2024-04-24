<script setup lang="ts">
  import Toggle from '@vueform/toggle'
  import { ref } from 'vue'
  import { useStore } from '../stores/store'
  import { useSettingsStore } from '../stores/settingsStore'
  import fs from '@mainnet-pat/indexeddb-fs';

  const nameWallet = "mywallet";

  const store = useStore()
  const settingsStore = useSettingsStore()

  const isBrowser = (process.env.MODE == "spa");
  const appVersion = process.env.version

  const displayeSeedphrase = ref(false);
  const selectedNetwork = ref(store.network);
  const selectedServer = ref(store.server);
  const selectedUnit  = ref(settingsStore.xmrUnit);
  const selectedDarkMode  = ref(settingsStore.darkMode);
  const emit = defineEmits(['changeView','changeNetwork']);

  function changeUnit(){
    settingsStore.xmrUnit = selectedUnit.value;
    localStorage.setItem("unit", selectedUnit.value);
    emit('changeView', 1);
  }
  function changeNetwork(){
    switch (selectedNetwork.value){
      case "mainnet":
        store.network = "mainnet";
        store.server = localStorage.getItem(`server-${store.network}`) ?? "https://monerod.slvit.us:443";
        break;
      case "testnet":
        store.network = "testnet";
        // store.server = "http://localhost:18081";
        store.server = localStorage.getItem(`server-${store.network}`) ?? "https://testnet.xmr.ditatompel.com:443";
        break;
    }
    selectedServer.value = store.server as string;
    localStorage.setItem('network', store.network);
    localStorage.setItem(`server-${store.network}`, store.server!);
    location.reload();
  }
  function changeServer(){
    store.server = selectedServer.value as string;
    localStorage.setItem(`server-${selectedNetwork.value}`, store.server);
    emit('changeNetwork', selectedNetwork.value, selectedServer.value);
  }
  function changeDarkMode(){
    settingsStore.darkMode = selectedDarkMode.value;
    localStorage.setItem("darkMode", selectedDarkMode.value? "true" : "false");
    selectedDarkMode.value ? document.body.classList.add("dark") : document.body.classList.remove("dark")
  }
  function toggleShowSeedphrase(){
    displayeSeedphrase.value = !displayeSeedphrase.value;
  }
  async function confirmDeleteWallet(){
    let text = "You are about to delete your Monujo wallet info from this browser.\nAre you sure you want to delete?";
    if (confirm(text)){
      await fs.removeFile(`${nameWallet}-${store.network}`);
      await fs.removeFile(`${nameWallet}-${store.network}.address.txt`);
      await fs.removeFile(`${nameWallet}-${store.network}.keys`);
      location.reload();
    }
  }
</script>

<template>
  <fieldset class="item">
    <legend>Settings</legend>
    <div v-if="!isBrowser" style="margin-bottom: 15px;">Monujo App Version: {{ appVersion }}</div>
    <div>Dark mode
      <Toggle v-model="selectedDarkMode" @change="changeDarkMode()" style="vertical-align: middle;toggle-height: 5.25rem; display: inline-block;"/>
    </div>
    <div style="margin-top:15px">
      <label for="selectUnit">Select default unit:</label>
      <select v-model="selectedUnit" @change="changeUnit()">
        <option value="xmr">XMR</option>
        <option value="piconero">piconero</option>
      </select>
    </div>
    <div style="margin-top:15px">
      <label for="selectNetwork">Change network:</label>
      <select v-model="selectedNetwork" @change="changeNetwork()">
        <option value="mainnet">mainnet</option>
        <option value="testnet">testnet</option>
      </select>
    </div>
    <div style="margin-top:15px;">
      <label for="selectServer">Change server:</label>
      <div style="display: flex; flex-direction: row; gap: 15px;">
        <input v-model="selectedServer" />
        <button class="primaryButton" @click="changeServer()">Apply</button>
      </div>
      <div>
        <a href="https://monero.fail/?chain=monero&network=mainnet&cors=on" target="_blank">List of Monero public nodes</a>
      </div>
    </div>
    <div style="margin-top:15px">Make backup of seed phrase (mnemonic)</div>
    <input @click="toggleShowSeedphrase()" class="button primary" type="button" style="padding: 1rem 1.5rem; display: block;"
      :value="displayeSeedphrase? 'Hide seed phrase' : 'Show seed phrase'"
    >
    <div v-if="displayeSeedphrase" id="seedphrase"> {{store.mnemonic }}</div>
    <br>
    <div style="margin-top:15px">Remove wallet data from {{isBrowser? "browser": "application"}}</div>
    <input @click="confirmDeleteWallet()" type="button" id="burnNFT" value="Delete wallet" class="button error" style="display: block;">
  </fieldset>
</template>

<style src="@vueform/toggle/themes/default.css"></style>
