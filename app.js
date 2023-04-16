#!/usr/bin/env node

const { z } = require('zod');
const { match } = require('ts-pattern');
const { exec } = require('child_process');
const { intro, outro, select, multiselect, text } = require('@clack/prompts');

// utils
function execute(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }

      if (stderr) {
        return reject(stderr);
      }

      resolve(stdout);
    });
  });
}

function getClarkPromptStructureForSelect(array) {
  return array.map((value) => ({ value, label: value }));
}

// helpers
async function getNetworkServices() {
  const value = await execute(`networksetup -listnetworkserviceorder`);
  return value.match(/\(\d+\) (.+)$/gm).map((match) => match.substring(4));
}

function setDNSToNetworkService(networkService, dnsList) {
  return execute(`networksetup -setdnsservers "${networkService}" ${dnsList.join(' ')}`);
}

// CLI
async function main() {
  intro(`FAST DNS ⚡️`);

  const networkServices = await getNetworkServices();

  // 1. Select DNS
  const CLOUDFARE_DNS = ['1.1.1.1', '1.0.0.1', '2606:4700:4700::1111', '2606:4700:4700::1001'];

  const selectedDNSToUse = await select({
    message: 'Which DNS you will like to use?',
    options: [
      {
        value: CLOUDFARE_DNS,
        label: 'CloudFlare DNS (1.1.1.1)',
        hint: 'recommended',
      },
      {
        value: false,
        label: 'Let me pick my custom DNS',
      },
    ],
  });

  const dnsSelected = await match(selectedDNSToUse)
    .with(false, async () => {
      const customDNS = await text({
        message: 'Insert a custom DNS',
        validate(value) {
          const validation = z.string().ip({ message: 'Invalid IP' }).safeParse(value);
          if (validation.success === false) return validation.error.issues[0].message;
        },
      });

      return [customDNS];
    })
    .with(CLOUDFARE_DNS, () => CLOUDFARE_DNS)
    .exhaustive();

  // 2. Select Network Services
  const selectedNetworkServices = await multiselect({
    message: 'Select Network Services to set DNS.',
    options: getClarkPromptStructureForSelect(networkServices),
    required: true,
  });

  // 3. Set DNS on Network Services
  for (const selectedNetworkService of selectedNetworkServices) {
    setDNSToNetworkService(selectedNetworkService, dnsSelected);
  }

  outro(`All your DNS are set, Enjoy faster and more secure internet!  `);
}

main();
