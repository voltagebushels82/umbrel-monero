<template v-slot:modal-header="{ close }" title="Connect to Monero Node">
  <div
    class="px-2 px-sm-3 pt-2 d-flex flex-column justify-content-between w-100 mt-n4"
  >
    <h3>Connect to Monero Node</h3>
    <p class="text-muted mb-md-4">
      Connect any wallet that supports Monero's RPC or P2P connection to your
      node using these details.
    </p>
    <div class="pb-2 pb-sm-3">
      <div class="row flex-column-reverse flex-lg-row">
        <div class="col-12 col-lg-4">
          <!-- QR Code -->
          <qr-code
            :value="chosenConnectionString"
            :size="225"
            class="qr-image mx-auto mt-1"
            showLogo
          ></qr-code>
        </div>
        <div class="col-12 col-lg-8 align-items-center">
          <label class="mb-1 d-block"
            ><small class="font-weight-bold"
              >Select mode and network</small
            ></label
          >
          <b-form-select
            class="mb-2"
            v-model="chosenMode"
            :options="modes"
          ></b-form-select>

          <!-- RPC Section -->
          <div
            v-if="
              chosenMode === 'rpcTor' ||
                chosenMode === 'rpcLocal' ||
                chosenMode === 'rpcRestricted'
            "
          >
            <b-row>
              <b-col cols="12" lg="6">
                <label class="mb-1 d-block"
                  ><small class="font-weight-bold"
                    >Monero RPC Username</small
                  ></label
                >
                <input-copy
                  v-if="rpc.rpcuser"
                  class="mb-2"
                  size="sm"
                  :value="rpc.rpcuser"
                ></input-copy>
                <span
                  class="loading-placeholder loading-placeholder-lg mt-1"
                  style="width: 100%;"
                  v-else
                ></span>
              </b-col>

              <b-col cols="12" lg="6">
                <label class="mb-1 d-block"
                  ><small class="font-weight-bold"
                    >Monero RPC Password</small
                  ></label
                >
                <input-copy
                  v-if="rpc.rpcpassword"
                  class="mb-2"
                  size="sm"
                  :value="rpc.rpcpassword"
                ></input-copy>
                <span
                  class="loading-placeholder loading-placeholder-lg mt-1"
                  style="width: 100%;"
                  v-else
                ></span>
              </b-col>

              <b-col cols="12" lg="6">
                <label class="mb-1 d-block"
                  ><small class="font-weight-bold"
                    >Monero RPC Address (Host)</small
                  ></label
                >
                <input-copy
                  v-if="rpc.torAddress || rpc.localAddress"
                  class="mb-2"
                  size="sm"
                  :value="
                    chosenMode === 'rpcTor' ? rpc.torAddress : rpc.localAddress
                  "
                ></input-copy>
                <span
                  class="loading-placeholder loading-placeholder-lg mt-1"
                  style="width: 100%;"
                  v-else
                ></span>
              </b-col>

              <b-col cols="12" lg="6">
                <label class="mb-1 d-block"
                  ><small class="font-weight-bold"
                    >Monero RPC Port</small
                  ></label
                >
                <input-copy
                  v-if="rpc.port"
                  class="mb-2"
                  size="sm"
                  :value="
                    chosenMode === 'rpcRestricted'
                      ? rpc.restrictedPort
                      : rpc.port
                  "
                ></input-copy>
                <span
                  class="loading-placeholder loading-placeholder-lg mt-1"
                  style="width: 100%;"
                  v-else
                ></span>
              </b-col>
            </b-row>
          </div>
          <!-- P2P Section -->
          <div v-if="chosenMode === 'p2pLocal' || chosenMode === 'p2pTor'">
            <label class="mb-1 d-block"
              ><small class="font-weight-bold"
                >Monero P2P Address (Host)</small
              ></label
            >
            <div>
              <input-copy
                v-if="p2p.torAddress || p2p.localAddress"
                class="mb-2"
                size="sm"
                :value="
                  chosenMode === 'p2pTor' ? p2p.torAddress : p2p.localAddress
                "
              ></input-copy>
              <span
                class="loading-placeholder loading-placeholder-lg mt-1"
                style="width: 100%;"
                v-else
              ></span>
            </div>
            <label class="mb-1 d-block"
              ><small class="font-weight-bold">Monero P2P Port</small></label
            >
            <div v-if="p2p.port">
              <input-copy class="mb-2" size="sm" :value="p2p.port"></input-copy>
            </div>
            <span
              class="loading-placeholder loading-placeholder-lg mt-1"
              style="width: 100%;"
              v-else
            ></span>
          </div>
        </div>
      </div>
      <p class="mt-2">
        Looking for step-by-step instructions to connect your wallet to your
        Monero node?
        <a
          href="https://www.getmonero.org/resources/user-guides/remote_node_gui.html"
          target="_blank"
          >Click here</a
        >.
      </p>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import QrCode from "@/components/Utility/QrCode";
import InputCopy from "@/components/Utility/InputCopy";

export default {
  data() {
    return {
      chosenMode: "rpcTor",
      modes: [
        { value: "rpcTor", text: "RPC (Tor)" },
        { value: "rpcLocal", text: "RPC (IP - Full Access)" },
        { value: "rpcRestricted", text: "RPC (IP - Restricted Access)" },
        { value: "p2pTor", text: "P2P (Tor)" },
        { value: "p2pLocal", text: "P2P (Local Network)" }
      ]
    };
  },
  computed: {
    ...mapState({
      rpc: state => state.monero.rpc,
      p2p: state => state.monero.p2p
    }),
    chosenConnectionString() {
      if (this.chosenMode === "rpcTor") {
        return this.rpc.torConnectionString;
      }
      if (this.chosenMode === "rpcLocal") {
        return this.rpc.localConnectionString;
      }
      if (this.chosenMode === "rpcRestricted") {
        return this.rpc.restrictedConnectionString;
      }
      if (this.chosenMode === "p2pTor") {
        return this.p2p.torConnectionString;
      }
      if (this.chosenMode === "p2pLocal") {
        return this.p2p.localConnectionString;
      }
      return "";
    }
  },
  created() {
    console.log(this.rpc, this.p2p);
  },
  components: {
    QrCode,
    InputCopy
  }
};
</script>
