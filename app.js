#!/usr/bin/env node

import { z } from 'zod';
import { match } from 'ts-pattern';
import invariant from 'tiny-invariant';
import { execSync } from 'child_process';
import { intro, outro, select, multiselect, text, cancel } from '@clack/prompts';

// constants
const CLOUDFARE_DNS = ['1.1.1.1', '1.0.0.1', '2606:4700:4700::1111', '2606:4700:4700::1001'];

// common utils
function execute(command) {
  return execSync(command).toString().trim();
}

function getClarkPromptStructureForSelect(array) {
  return array.map((value) => ({ value, label: value }));
}

// network utils
async function getNetworkServices() {
  const value = execute(`networksetup -listnetworkserviceorder`);

  const networkServices = value.match(/\(\d+\) (.+)$/gm);
  invariant(networkServices, 'No network services found');

  return networkServices.map((match) => match.substring(4));
}

function setDnsToNetworkService(networkService, dnsList) {
  return execute(`networksetup -setdnsservers "${networkService}" ${dnsList.join(' ')}`);
}

// CLI
async function main() {
  try {
    intro(`FAST DNS ⚡️`);

    const networkServices = await getNetworkServices();

    // 1. Select DNS
    const selectedDnsToUse = await select({
      message: 'Which DNS you will like to use?',
      options: [
        {
          value: CLOUDFARE_DNS,
          label: 'CloudFlare DNS',
          hint: 'recommended',
        },
        {
          value: false,
          label: 'Let me pick my custom DNS',
        },
      ],
    });

    const dnsSelected = await match(selectedDnsToUse)
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
    invariant(Array.isArray(selectedNetworkServices), 'You need to select at least one network service');

    // 3. Set DNS on Network Services
    for (const selectedNetworkService of selectedNetworkServices) {
      setDnsToNetworkService(selectedNetworkService, dnsSelected);
    }

    outro(`All your DNS are set, Enjoy faster and more secure internet!  `);
  } catch (error) {
    cancel(`🚨 Something went wrong: "${error.message}"`);
    process.exit(0);
  }
}

main();
