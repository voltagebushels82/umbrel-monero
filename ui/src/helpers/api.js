import axios from "axios";


// An object to store the response time of completed API requests
const responseTime = {};

// An object to store pending API requests
const responsePending = {};

// Helper methods for making API requests
const API = {
  async get(url, data = {}) {
    let response;

    if (responsePending[url] === undefined || responsePending[url] === false) {
      responsePending[url] = true;

      try {
        const startTime = new Date();
        // await new Promise(resolve => setTimeout(resolve, 2000)) //2s API delay

        const requestOptions = {
          method: "get",
          url
        };

        response = (await axios(requestOptions, data)).data;
        const endTime = new Date();

        responseTime[url] = (endTime.getTime() - startTime.getTime()) / 1000;
      } catch (error) {
        // Only display error messages in the browser console
        if (typeof window !== "undefined") {
          console.error(error);
        }

        response = false;
      } finally {
        responsePending[url] = false; // eslint-disable-line require-atomic-updates
      }
    }

    return response;
  },

  // Wrap a post call
  async post(url, data = {}) {
    const requestOptions = {
      method: "post",
      url,
      data
    };

    return axios(requestOptions);
  },

  // Wrap a delete call
  async delete(url, data) {
    const requestOptions = {
      method: "delete",
      url,
      data
    };

    return axios(requestOptions);
  },

  // Wrap a download call (GET)
  async download(url, data = {}, filename = "download") {
    let response;

    if (responsePending[url] === undefined || responsePending[url] === false) {
      responsePending[url] = true;

      try {
        const startTime = new Date();
        // await new Promise(resolve => setTimeout(resolve, 2000)) //2s API delay

        const requestOptions = {
          method: "get",
          url,
          responseType: "blob"
        };

        response = (await axios(requestOptions, data)).data;

        const endTime = new Date();
        responseTime[url] = (endTime.getTime() - startTime.getTime()) / 1000;

        // Download file
        const blob = new Blob([response]);
        const blobURL =
          window.URL && window.URL.createObjectURL
            ? window.URL.createObjectURL(blob)
            : window.webkitURL.createObjectURL(blob);
        const tempLink = document.createElement("a");
        tempLink.style.display = "none";
        tempLink.href = blobURL;
        tempLink.setAttribute("download", filename);

        // Safari thinks _blank anchor are pop ups. We only want to set _blank
        // target if the browser does not support the HTML5 download attribute.
        // This allows us to download files in desktop safari if pop up blocking
        // is enabled.
        if (typeof tempLink.download === "undefined") {
          tempLink.setAttribute("target", "_blank");
        }

        document.body.appendChild(tempLink);
        tempLink.click();

        // Fixes "webkit blob resource error 1"
        setTimeout(function() {
          document.body.removeChild(tempLink);
          window.URL.revokeObjectURL(blobURL);
        }, 200);
      } catch (error) {
        // Only display error messages in the browser console
        if (typeof window !== "undefined") {
          console.error(error);
        }

        response = false;
      } finally {
        responsePending[url] = false; // eslint-disable-line require-atomic-updates
      }
    }

    return response;
  },

  // Return the response time if this URL has already been fetched
  responseTime(url) {
    let duration = -1;

    if (responseTime[url] !== undefined) {
      duration = responseTime[url];
    }

    return duration;
  }
};

export default API;
