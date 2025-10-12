#!/usr/bin/env node

/**
 * Add the top 100 ETH whale addresses
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const ethWhales = [
  "0x6090a6e47849629b7245dfa1ca21d94cd15878ef",
  "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
  "0x40b38765696e3d5d8d9d834d8aad4bb6e418e489",
  "0x1b75b90e60070d37cfa9d87affd124bb345bf70a",
  "0x0e58e8993100f1cbe45376c410f97f4893d9bfcd",
  "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a",
  "0x49048044d57e1c92a77f79988d21fa8faf74e97e",
  "0xf977814e90da44bfa03b6295a0616a897441acec",
  "0x84ef4b2357079cd7a7c69fd7a37cd0609a679106",
  "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",
  "0xe92d1a43df510f82c66382592a047d288f85226f",
  "0x8d05d9924fe935bd533a844271a1b2078eae6fcf",
  "0xca8fa8f0b631ecdb18cda619c4fc9d197c8affca",
  "0x61edcdf5bb737adffe5043706e7c5bb1f1a56eea",
  "0xd3a22590f8243f8e83ac230d1842c9af0404c4a1",
  "0x3bfc20f0b9afcace800d73d2191166ff16540258",
  "0x9f1799fb47b1514f453bcebbc37ecfe883756e83",
  "0x8103683202aa8da10536036edef04cdd865c225e",
  "0xf4c64518ea10f995918a454158c6b61407ea345c",
  "0xafcd96e580138cfa2332c632e66308eacd45c5da",
  "0x0a4c79ce84202b03e95b7a692e5d728d83c44c76",
  "0x539c92186f7c6cc4cbf443f26ef84c595babbca1",
  "0xbfbbfaccd1126a11b8f84c60b09859f80f3bd10f",
  "0x868dab0b8e21ec0a48b726a1ccf25826c78c6d7f",
  "0xf30ba13e4b04ce5dc4d254ae5fa95477800f0eb0",
  "0xfec6f679e32d45e22736ad09dfdf6e3368704e31",
  "0xd2dd7b597fd2435b6db61ddf48544fd931e6869f",
  "0x17e5545b11b468072283cee1f066a059fb0dbf24",
  "0x5a52e96bacdabb82fd05763e25335261b270efcb",
  "0xaa2aa15d77b41e151e17f3a61cbc68db4da72a90",
  "0x322b47ff1fa8d5611f761e3e275c45b71b294d43",
  "0x866c9a77d8ab71d2874703e80cb7ad809b301e8e",
  "0xbf3aeb96e164ae67e763d9e050ff124e7c3fdd28",
  "0x1157a2076b9bb22a85cc2c162f20fab3898f4101",
  "0x5b5b69f4e0add2df5d2176d7dbd20b4897bc7ec4",
  "0x2f2d854c1d6d5bb8936bb85bc07c28ebb42c9b10",
  "0x7bbfaa2f8b2d2a613b4439be3428dfbf0f405390",
  "0x73af3bcf944a6559933396c1577b257e2054d935",
  "0xd19d4b5d358258f05d7b411e21a1460d11b0876f",
  "0x5ed5690c07cc0ee1f8b6692c2c227983bc71ba9c",
  "0xa4803f17607b7cdc3dc579083d9a14089e87502b",
  "0xb5ab08d153218c1a6a5318b14eeb92df0fb168d6",
  "0xa023f08c70a23abc7edfc5b6b5e171d78dfc947e",
  "0x08eee92b8ef65183cf280640452d418df072fa2a",
  "0xc882b111a75c0c657fc507c04fbfcd2cc984f071",
  "0xa1a45e91164cdab8fa596809a9b24f8d4fdbe0f3",
  "0x376c3e5547c68bc26240d8dcc6729fff665a4448",
  "0x1c5e29b17822cc96b834092ec056a9cd4e833c09",
  "0xa48c30a3fbcd08c8d3eda23e2d9a32de47a54822",
  "0x6e414cfad874d8ee716ea0299d40011207c907b8",
  "0xfcd159d0fef5b1003e10d91a5b79d52bbb8cd05d",
  "0x8ae880b5d35305da48b63ce3e52b22d17859f293",
  "0xa463597d49f54fe6a811fb894cbd67c7f92852b0",
  "0x5a710a3cdf2af218740384c52a10852d8870626a",
  "0xde6cf64ec6ad9fc35b38fff55cae1f469cbc1703",
  "0xbed96d0840201011df1467379a5d311e0040073a",
  "0xc1e04b6dafa47fd608300b1e0c2cd0081befc176",
  "0x0100dc5672f702e705fc693218a3ad38fed6553d",
  "0x4eac9ce57af61a6fb1f61f0bf1d8586412be30bc",
  "0x999e77c988c4c1451d3b1c104a6cca7813a9946e",
  "0xd9858d573a26bca124282afa21ca4f4a06eff98a",
  "0x4fdd5eb2fb260149a3903859043e962ab89d8ed4",
  "0xd8d98ee915a5a4f52c40d97fcd8ffadea1ee8604",
  "0x40f50e8352d64af0ddda6ad6c94b5774884687c3",
  "0x2d89034424db22c9c555f14692a181b22b17e42c",
  "0x303c741bb15c9c4b1c72320f6df702b32da80519",
  "0xe9a5a2acfa9bee149ed28fcbf12b60ff2ad97efb",
  "0xe93fc974908003faddf0bd972b05b6494368d3f5",
  "0x36b6751586614d647d8a3f495e82bdcf250914c8",
  "0x28140cb1ac771d4add91ee23788e50249c10263d",
  "0xc56fefd1028b0534bfadcdb580d3519b5586246e",
  "0xf196c023de1f19d6529133759f449c4b01ce0f51",
  "0x86a6a0080b1a4c9390416cf73ffb02738d94f8d6",
  "0x9030dcb01830eaa3d8ba285a824a05d8fb489ad0",
  "0x08ba0023ed60c7bd040716dd13c45fa0062df5c5",
  "0x807cc0e799dcc651d94595e1f7f6e7373ef8f96a",
  "0xa580e49df5d054d69cf1b2ef4af847c6e6f64d30",
  "0x9b07c94f1d39d24b68da8ff7c78adb8b70238a75",
  "0x22a54a1eb8c573bbf845dd1ff64c8df05502c1b0",
  "0xda29accfb77995bef70bcf6478a73e9acb07732d",
  "0xf29c6705f188526e0029a92ee6bc21ebc750b675",
  "0x03d615c04be905790dbef2df0472a2e901ccd810",
  "0x5d71f4d4f6048112a3b21433fbcfba5f1f39549f",
  "0x6fb8ebc19bc2a9fa4413ba6a0ca6fa99e974b461",
  "0x3727cfcbd85390bb11b3ff421878123adb866be8",
  "0x7d6149ad9a573a6e2ca6ebf7d4897c1b766841b4",
  "0x1bb762b16438f8b287626fd1042bc6f6848cc286",
  "0xad0d53cf033ab63dc72d653640766ee1d366cef6",
  "0xac08f21ef597a51865d69896f09b52472acde80d",
  "0x6586ce3d543e0c57b347f0c3b9eeed2f132c104f",
  "0x3f4ac8d3e1414b5351e632391908177c012c65cc",
  "0xb3764761e297d6f121e79c32a65829cd1ddb4d32",
  "0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f",
  "0xc54cb22944f2be476e02decfcd7e3e7d3e15a8fb",
  "0xb46427e2cddecb0bde40bf402361effddd4401e2",
  "0x28c6c06298d514db089934071355e5743bf21d60",
  "0xddfa14b51e25ea8ea16d854cd4de263ad4e04f6e",
  "0x2fd56159f4c8664a1de5c75e430338cfa58cd5b9",
  "0xc39cc669a548c661dfa6b5a1eeaa389d1ec53143",
  "0x02d613c8e5646bf3649c6a32ea0367880a0fb392"
];

async function addETHWhales() {
  console.log(chalk.cyan.bold('\n🐋 Adding Top 100 ETH Whale Addresses...\n'));

  // Load existing whales
  const dataDir = './data';
  const whalesFile = path.join(dataDir, 'whales.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let whales = {};
  if (fs.existsSync(whalesFile)) {
    whales = JSON.parse(fs.readFileSync(whalesFile, 'utf-8'));
  }

  const now = Date.now();
  let newCount = 0;
  let skippedCount = 0;

  console.log(chalk.yellow(`Processing ${ethWhales.length} ETH whale addresses...\n`));

  for (const address of ethWhales) {
    if (whales[address]) {
      console.log(chalk.gray(`  ⊘ ${address.slice(0, 8)}...${address.slice(-6)} (already tracked)`));
      skippedCount++;
    } else {
      whales[address] = {
        address,
        firstSeen: now,
        totalTrades: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        totalPnL: 0,
        marginUsed: 0,
        roi: 0,
        winRate: 0,
        largestPosition: 0,
        activePositions: 0,
        lastUpdated: now,
        source: 'eth-whales-top-100',
        lastActive: null
      };
      console.log(chalk.green(`  ✓ ${address.slice(0, 8)}...${address.slice(-6)} (added)`));
      newCount++;
    }
  }

  // Save
  fs.writeFileSync(whalesFile, JSON.stringify(whales, null, 2));

  console.log(chalk.green.bold(`\n✅ Added ${newCount} new ETH whale addresses`));
  if (skippedCount > 0) {
    console.log(chalk.gray(`   Skipped ${skippedCount} already tracked`));
  }
  console.log(chalk.green(`✅ Total addresses tracked: ${Object.keys(whales).length}`));

  console.log(chalk.cyan.bold('\n🚀 Ready to start! Run: npm run dev\n'));

  // Show top 10 by ETH holdings
  console.log(chalk.yellow.bold('🏆 TOP 10 ETH WHALES (by holdings):\n'));
  const top10 = ethWhales.slice(0, 10);
  const holdings = [
    3308877.45, 1996008.43, 1177794.80, 959413.54, 762963.94,
    759800.41, 717904.64, 688623.38, 598974.33, 554999.06
  ];
  
  top10.forEach((addr, i) => {
    console.log(chalk.white(`${i + 1}. ${addr.slice(0, 10)}...${addr.slice(-6)}`));
    console.log(chalk.gray(`   ETH Holdings: ${(holdings[i] / 1000).toFixed(0)}K ETH`));
  });

  console.log(chalk.cyan('\n💡 These are massive ETH holders - perfect for tracking!'));
}

addETHWhales().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});
