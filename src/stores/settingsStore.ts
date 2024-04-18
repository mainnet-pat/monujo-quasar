import { defineStore } from "pinia"
import { ref } from 'vue'

export const useSettingsStore = defineStore('settingsStore', () => {

  // Global settings
  const xmrUnit = ref("xmr" as ("xmr" | "piconero"));
  const darkMode  = ref(false);

  // read local storage
  const readUnit = localStorage.getItem("unit");
  const readDarkMode = localStorage.getItem("darkMode");
  if(readUnit && (readUnit=="xmr" || readUnit=="piconero")) xmrUnit.value = readUnit;
  if(readDarkMode == "true"){
    document.body.classList.add("dark");
    darkMode.value = true;
  }

  return { xmrUnit, darkMode }
})
