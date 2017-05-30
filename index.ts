/// <reference path="local_types.ts" />

const KEY_URL: string = 'url';
const KEY_USERNAME: string = 'username';
const KEY_PASSWORD: string = 'password';
const TARGET_TEMPERATURE_MAX: number = 85;
const TARGET_TEMPERATURE_MIN: number = 60;

class ThermostatState {
  private _currentTemp: number;
  private _targetTemp: number;
  private _isOverride: boolean;
  private _isHold: boolean;
  private _isFanRunning: boolean;
  private _thermostatMode: number;
  private _thermostatState: number;
  private _fanMode: number;

  public static readonly TMODE_OFF: number = 0;
  public static readonly TMODE_HEAT: number = 1;
  public static readonly TMODE_COOL: number = 2;
  public static readonly TMODE_AUTO: number = 3;

  public static readonly TSTATE_OFF: number = 0;
  public static readonly TSTATE_HEAT: number = 1;
  public static readonly TSTATE_COOL: number = 2;

  public static readonly FMODE_AUTO: number = 0;
  public static readonly FMODE_CIRCULATE: number = 1;
  public static readonly FMODE_ON: number = 2;

  public constructor(json: any) {
    this._currentTemp = json.temp;
    this._thermostatMode = json.tmode;
    this._thermostatState = json.tstate;
    this._fanMode = json.fmode;
    this._isFanRunning = json.fstate;
    this._isOverride = json.override;
    this._isHold = json.hold;
    if (json.t_heat !== undefined) {
      this._targetTemp = json.t_heat;
    } else {
      this._targetTemp = json.t_cool;
    }
  }

  public get currentTemp(): number {
    return this._currentTemp;
  }

  public get targetTemp(): number {
    return this._targetTemp;
  }

  public get isOverride(): boolean {
    return this._isOverride;
  }

  public get isHold() : boolean {
    return this._isHold;
  }

  public get fanMode() : number {
    return this._fanMode;
  }

  public get isFanRunning() : boolean {
    return this._isFanRunning;
  }

  public get thermostatMode() : number {
    return this._thermostatMode;
  }

  public get thermostatState() : number {
    return this._thermostatState;
  }

  public get thermostatStateAsText() : string {
    switch (this._thermostatState) {
      case ThermostatState.TSTATE_OFF:
        return "Off";
      case ThermostatState.TSTATE_HEAT:
        return "Heating";
      case ThermostatState.TSTATE_COOL:
        return "Cooling";
      default:
        return "Unknown";
    }
  }
}

class Thermostat {
  private url: string;
  private username: string;
  private password: string;
  private _state: ThermostatState;

  public constructor(url: string, username: string, password: string) {
    this.url = url;
    this.username = username;
    this.password = password;
  }

  public refreshState(successCallback: (ThermostatState) => void) {
    let xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.open("GET", this.url, true);
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(this.username + ':' + this.password));
    let thisThermostat : Thermostat = this;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          thisThermostat._state = new ThermostatState(JSON.parse(xhr.responseText));
          successCallback(thisThermostat._state);
        } else {
          console.error("thermostat API call returned " + xhr.status);
        }
      }
    };
    xhr.send();
  }

  public get state(): ThermostatState {
    if (this._state === null) {
      this.refreshState(function(newState: ThermostatState) {
        this._state = newState;
      })
    }
    return this._state;
  }

  public setTargetTemp(newTargetTemp: number, callback: (boolean) => void) {
    let heatOrCool: string = "t_cool";
    if (this.state.thermostatMode == ThermostatState.TMODE_HEAT) {
      heatOrCool = "t_heat";
    }
    let request = {};
    request[heatOrCool] = newTargetTemp;
    console.log("setting target temperature (" + heatOrCool + ") to: " + newTargetTemp);
    let xhr: XMLHttpRequest = new XMLHttpRequest();
    xhr.open("POST", this.url, true);
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(this.username + ':' + this.password));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          let response = JSON.parse(xhr.responseText);
          if ("success" in response) {
            callback(true);
          } else {
            callback(false);
          }
        } else {
          console.error("set target temp returned " + xhr.status);
          callback(false);
        }
      }
    };
    xhr.send(JSON.stringify(request));
  }
}

let thermostat: Thermostat = null;

function getSettings() {
  let url: string = localStorage.getItem(KEY_URL);
  let username: string = localStorage.getItem(KEY_USERNAME);
  let password: string = localStorage.getItem(KEY_PASSWORD);

  if (url !== null      && url !== '' &&
      username !== null && username !== '' &&
      password !== null && password !== '') {
    return {
      "url": url,
      "username": username,
      "password": password,
    };
  }
  return null;
}

function routePage() {
  let pageName: string = (window.location.hash) ? window.location.hash : "#home";
  console.log("routePage: we are at: " + pageName);
  // Hide all pages
  let pages: HTMLCollectionOf<Element> = document.getElementsByClassName("pages");
  for (let i=0; i < pages.length; i++) {
    (pages[i] as HTMLElement).style.display = "none";
    (pages[i] as HTMLElement).removeAttribute("hidden");
  }
  // Close the drawer if it's open
  let drawer: Element = document.getElementById("drawer");
  if (drawer.classList.contains("is-visible")) {
    let d = document.querySelector('.mdl-layout');
    (d as any).MaterialLayout.toggleDrawer();
  }
  let selectedPage: Element = document.querySelector(pageName);
  (selectedPage as HTMLElement).style.display = "block";
  var routingMap = {
    "#home": render_home,
    "#schedule": render_schedule,
    "#settings": render_settings,
  };
  if (thermostat === null) {
    console.log("forcing settings page because we're not configured");
    window.location.hash = "#settings";
  }
  if (routingMap[pageName]) {
    routingMap[pageName]();
  }
}

function setBusy(busy: boolean) {
  let busyOverlay: HTMLElement = document.getElementById('busy');
  let spinner: HTMLElement = document.getElementById('spinner');

  if (busy) {
    busyOverlay.style.display = "block";
    spinner.classList.add('is-active');  
  } else {
    spinner.classList.remove('is-active');
    busyOverlay.style.display = "none";
  }
}

function render_home() {
  console.log("render_home()");
  setBusy(true);
  let state: ThermostatState;
  console.log("getting current thermostat state ...");
  thermostat.refreshState(function(currentState) {
    state = currentState;
    setBusy(false);

    let currentTemp: HTMLElement = document.getElementById('temperature-current');
    currentTemp.textContent = currentState.currentTemp;

    let targetTemp: HTMLElement = document.getElementById('temperature-target');
    targetTemp.textContent = currentState.targetTemp;

    let heatingOrCooling: HTMLElement = document.getElementById('state-current');
    heatingOrCooling.textContent = currentState.thermostatStateAsText;
  });

}

function render_schedule() {
  console.log("render_schedule()");
}

function render_settings() {
  console.log("render_settings()");
  let settings = getSettings();
  if (settings === null) {
    return;
  }

  let urlField: HTMLInputElement = <HTMLInputElement>document.getElementById('url');
  urlField.value = settings.url;
  urlField.parentElement.classList.add('is-dirty');

  let usernameField: HTMLInputElement = <HTMLInputElement>document.getElementById('username');
  usernameField.value = settings.username;
  usernameField.parentElement.classList.add('is-dirty');

  let passwordField: HTMLInputElement = <HTMLInputElement>document.getElementById('password');
  passwordField.value = settings.password;
  passwordField.parentElement.classList.add('is-dirty');
}

// Add listeners
document.getElementById('apply-settings').addEventListener('click', function() {
  let url = (<HTMLInputElement>document.getElementById('url')).value;
  let username = (<HTMLInputElement>document.getElementById('username')).value;
  let password = (<HTMLInputElement>document.getElementById('password')).value;
  localStorage.setItem(KEY_URL, url);
  localStorage.setItem(KEY_USERNAME, username);
  localStorage.setItem(KEY_PASSWORD, password);

  thermostat = new Thermostat(url, username, password);

  let toast: Element = document.getElementById('apply-settings-toast');
  let data = {
    message: "Saved Settings"
  };
  (toast as any).MaterialSnackbar.showSnackbar(data);
});

document.getElementById('button-target-temperature').addEventListener('click', function() {
  document.getElementById('dialog-target-temperature-new-target').textContent = String(thermostat.state.targetTemp);
  let targetTemperatureDialog : Element = document.getElementById('dialog-target-temperature');
  (<HTMLDialogElement>targetTemperatureDialog).showModal();
});

document.getElementById('dialog-target-temperature-button-ok').addEventListener('click', function() {
  let targetTemperatureElement : Element = document.getElementById('dialog-target-temperature-new-target');
  let newTarget : number = Number(targetTemperatureElement.textContent);
  // close the dialog
  let targetTemperatureDialog : Element = document.getElementById('dialog-target-temperature');
  (<HTMLDialogElement>targetTemperatureDialog).close();
  setBusy(true);
  thermostat.setTargetTemp(newTarget, function(success: boolean) {
    render_home();
  });

});

document.getElementById('dialog-target-temperature-button-cancel').addEventListener('click', function() {
  let targetTemperatureDialog : Element = document.getElementById('dialog-target-temperature');
  (<HTMLDialogElement>targetTemperatureDialog).close();
});

document.getElementById('dialog-target-temperature-button-up').addEventListener('click', function() {
  let targetTemperature : Element = document.getElementById('dialog-target-temperature-new-target');
  let newTarget : number = Number(targetTemperature.textContent);
  if (newTarget < TARGET_TEMPERATURE_MAX) {
    newTarget++;
    targetTemperature.textContent = String(newTarget);
  }
});

document.getElementById('dialog-target-temperature-button-down').addEventListener('click', function() {
  let targetTemperature : Element = document.getElementById('dialog-target-temperature-new-target');
  let newTarget : number = Number(targetTemperature.textContent);
  if (newTarget > TARGET_TEMPERATURE_MIN) {
    newTarget--;
    targetTemperature.textContent = String(newTarget);
  }
});


// Route every time the hash part of the URL changes
window.onhashchange = function() {
  routePage();
};

// And route once to get us started
let settings = getSettings();
if (settings !== null) {
  thermostat = new Thermostat(settings.url, settings.username, settings.password);
}
routePage();