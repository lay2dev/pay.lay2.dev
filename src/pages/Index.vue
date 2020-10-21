<template>
  <q-page>
    <q-card class="q-ma-lg">
      <q-card-section class="q-py-sm">
        <div class="text-h6">Select a Provider</div>
      </q-card-section>
      <q-card-section class="row q-gutter-sm justify-evenly">
        <q-btn
          class="col"
          color="primary"
          :outline="providerName !== 'ETH'"
          label="ETH"
          @click="connect('ETH')"
        />
        <q-btn
          class="col"
          color="primary"
          :outline="providerName !== 'TRON'"
          label="Tron"
          @click="connect('TRON')"
        />
        <q-btn
          class="col"
          color="primary"
          :outline="providerName !== 'EOS'"
          label="EOS"
          @click="connect('EOS')"
        />
      </q-card-section>
      <q-separator spaced inset />
      <q-card-section class="column q-py-sm">
        <div class="column q-gutter-sm">
          <div class="row"><div class="q-pr-md">{{ providerName }} Address: </div><div class="text-bold text-secondary" style="word-break: break-all;">{{ nativeAddress }}</div></div>
          <div class="row"><div class="q-pr-md">CKB Address: </div><div class="text-bold text-green-6" style="word-break: break-all;">{{ ckbAddress }}</div></div>
          <div class="row"><div class="q-pr-md">CKB Balance: </div><div class="text-bold text-accent q-mr-xs">{{ balanceString }} </div>CKB</div>
          <div class="row"><div class="q-pr-md">PW-BTC Balance: </div><div class="text-bold text-accent q-mr-xs">{{ pwbtcBalanceString }} </div>PW-BTC</div>
        </div>
      </q-card-section>
    </q-card>
    <q-card class="q-ma-lg">
      <q-card-section class="column q-py-sm">
        <div class="column">
          <div class="row items-center"><div class="q-pr-md">Token: </div><div class="text-bold text-secondary col"><q-select debounce="500" v-model="tokenName" :options="options" /></div></div>
          <div class="row items-center"><div class="q-pr-md">ToAddr: </div><div class="text-bold text-secondary col"><q-input debounce="500" v-model="toAddressString" type="text" label="CKB / ETH / Tron / EOS Addresses" /></div></div>
          <div class="row items-center"><div class="q-pr-md">Amount: </div><div class="text-bold text-green-6 col"><q-input debounce="500" v-model="amountValue" type="text" :label="`Minimal Amount: ${minAmount} ${tokenName}`" /></div></div>
        </div>
      </q-card-section>
      <q-card-section class="column q-py-sm">
        <q-btn class="full-width" color="primary" icon="send" label="Send" @click="send" />
      </q-card-section>
      <q-card-section class="column q-py-sm">
        <q-separator spaced />
        <div class="text-h6"> Sent TX List</div>
        <a v-for="tx in txs" :key="tx" :href="`https://explorer.nervos.org/aggron/transaction/${tx}`" style="word-break: break-all;"> {{tx}} </a>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script>
import PWCore, {
  Amount,
  EthProvider,
  EosProvider,
  TronProvider, PwCollector, AmountUnit, Address, AddressType, Web3ModalProvider, SUDT
} from "@lay2/pw-core";

import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import supportedChains from "../services/chain";
import Torus from "@toruslabs/torus-embed";
import Web3 from "web3";

const NODE_URL = "https://testnet.ckb.dev";

const EOS_NETWORK = {
  blockchain: 'eos',
  chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
  host: 'eospush.tokenpocket.pro',
  port: 443,
  protocol: 'https',
}

const PWBTC_ISSURER_LOCKHASH = '0xc369a6fc6f0f907e46de96f668d986b8e4b52ea832da213f864eda805d34c932';

export default {
  name: "PageIndex",
  data() {
    return {
      providerName: "",
      provider: null,
      pw: null,
      web3Modal: null,

      address: null,
      balance: Amount.ZERO,
      toAddressString: null,
      pwbtcBalance: Amount.ZERO,
      tokenName: 'CKB',
      options: ['CKB', 'PW-BTC'],
      toAddress: null,
      minAmount: new Amount('61'),
      amountValue: null,
      amount: Amount.ZERO,

      txs: []
    };
  },
  computed: {
    nativeAddress() { return this.address ? this.address.addressString : '-' },
    ckbAddress() { return this.address ? this.address.toCKBAddress() : '-' },
    balanceString() { return this.balance.toString(AmountUnit.ckb, {commify: true})},
    pwbtcBalanceString() { return this.pwbtcBalance.toString(AmountUnit.ckb, {commify: true})}
  },
  async mounted() {
    this.web3Modal = new Web3Modal({
      network: getChainData(1).network,
      cacheProvider: false,
      providerOptions: getProviderOptions(),
    });

    await this.web3Modal.clearCachedProvider();

    if (this.web3Modal.cachedProvider) {
      this.connect();
    }
  },
  methods: {
    async connect(provider) {
      this.providerName = provider;
      switch(provider) {
        // case 'ETH': this.provider = new EthProvider(); break
        case 'ETH': const p = await this.web3Modal.connect(); console.log('Web3 Provider: ', p); this.provider = new Web3ModalProvider(new Web3(p)); break
        case 'EOS': this.provider = new EosProvider(EOS_NETWORK); break
        case 'TRON': this.provider = new TronProvider(); break
        default: throw new Error('Unsupported Provider')
      }
      this.$q.loading.show();
      this.pw = await new PWCore(NODE_URL).init(
        this.provider,
        new PwCollector('https://cellapitest.ckb.pw')
      );
      this.address = PWCore.provider.address;
      this.$q.loading.hide();
    },
    async send() {
      this.$q.loading.show();
      try {
        let txHash;
        if(this.tokenName === 'CKB'){
          txHash = await this.pw.send(this.toAddress, this.amount);
        }else{
          /**
           when createAcp is true, pw-core will create a acp cell for receiver.
           when createAcp is false, pw-core will not create acp cell for receiver. sudt will be transfered only if receiver already has acp cell.
           */
          const createAcp = true;
          txHash = await this.pw.sendSUDT(new SUDT(PWBTC_ISSURER_LOCKHASH), this.toAddress, this.amount, createAcp);
        }
        this.txs.unshift(txHash);
      } catch(err) {
        console.error('send tx error', err);
        alert(`send Error: ${JSON.stringify(err?.stack)}`);
      }
      this.$q.loading.hide();
    },
  },
  watch: {
    async address(address) {
      console.log("new address: ", address.addressString);
      this.balance = await PWCore.defaultCollector.getBalance(address);
      this.pwbtcBalance = await PWCore.defaultCollector.getSUDTBalance(new SUDT(PWBTC_ISSURER_LOCKHASH), address);
    },
    async toAddressString(addressString) {
      let addressType = AddressType.ckb;
      let lockArgs = null;
      if(addressString.startsWith('ck')) {
        addressType = AddressType.ckb;
      } else if (addressString.length === 12) {
        addressType = AddressType.eos;
        lockArgs = await Address.getEosLockArgs(EOS_NETWORK, addressString);
      } else if (addressString.startsWith('0x')) {
        addressType = AddressType.eth;
      } else {
        addressType = AddressType.tron;
      }

      this.toAddress = new Address(addressString, addressType, lockArgs);
      this.minAmount = this.toAddress.minPaymentAmount() || new Amount('61');
      console.log('to address: ', this.toAddress)
    },
    amountValue(amountValue) {
      this.amount = new Amount(`${amountValue}`);
      console.log('send amount: ', this.amount)
    }
  }
};

function getAddressType(provider) {
  if(provider === 'ETH') return AddressType.eth;
  if(provider === 'TRON') return AddressType.tron;
  if(provider === 'EOS') return AddressType.eos;
  throw new Error('unknow provider');
}

function getProviderOptions() {
  return {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // infuraId: process.env.REACT_APP_INFURA_ID
        infuraId: "89a648e271d54224ba4827d348cbaa54",
      },
    },
    torus: {
      package: Torus,
    },
  };
}

function getChainData(chainId) {
  const chainData = supportedChains.filter(
    (chain) => chain.chain_id === chainId
  )[0];
  if (!chainData) {
    throw new Error("ChainId missing or not supported");
  }
  // const API_KEY = process.env.REACT_APP_INFURA_ID;
  const API_KEY = "89a648e271d54224ba4827d348cbaa54";
  if (
    chainData.rpc_url.includes("infura.io") &&
    chainData.rpc_url.includes("%API_KEY%") &&
    API_KEY
  ) {
    const rpcUrl = chainData.rpc_url.replace("%API_KEY%", API_KEY);
    return {
      ...chainData,
      rpc_url: rpcUrl,
    };
  }
  return chainData;
}
</script>
