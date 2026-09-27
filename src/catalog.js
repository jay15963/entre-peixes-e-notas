// Tudo o que pode vir na linha. Dados puros (sem three.js): a simulação, os testes e a interface usam a mesma tabela.
// kind: fish | junk | treasure | special · tier: raridade exibida · diff: dificuldade (0..1) · rarity: peso do sorteio
// price: R$/kg (peixes) ou valor fixo (objetos) · shape: modelo 3D
export const TIERS={
  comum:{label:'COMUM',color:'#c9d3da',glow:'#e8f0f5'},incomum:{label:'INCOMUM',color:'#5fd068',glow:'#a9ffb0'},
  raro:{label:'RARO',color:'#3aa0ff',glow:'#a6d6ff'},epico:{label:'ÉPICO',color:'#b45cff',glow:'#e2b8ff'},
  lendario:{label:'LENDÁRIO',color:'#ffb627',glow:'#fff0a8'},lixo:{label:'LIXO',color:'#a88763',glow:'#d8c2a4'},
  especial:{label:'ENERGÉTICO',color:'#ffc81e',glow:'#fff3b0'}
};
export const CATCHES=[
  {name:'Sardinha',kind:'fish',tier:'comum',kg:[.08,.2],diff:.12,rarity:26,price:9,shape:'slim',len:.22,top:0x2b4f73,side:0xb9c8d2,belly:0xf2f4f5},
  {name:'Tainha',kind:'fish',tier:'comum',kg:[.5,1.3],diff:.28,rarity:20,price:16,shape:'slim',len:.38,top:0x4f5b62,side:0xa9b2b6,belly:0xe9ecea,stripes:true},
  {name:'Corvina',kind:'fish',tier:'incomum',kg:[.6,2.2],diff:.38,rarity:13,price:22,shape:'deep',len:.45,top:0x6b5a3c,side:0xc9ae78,belly:0xf1e6c8,line:true},
  {name:'Pargo-rosa',kind:'fish',tier:'incomum',kg:[.9,2.6],diff:.45,rarity:11,price:28,shape:'deep',len:.42,top:0xb8433f,side:0xe07f74,belly:0xf5d6cf},
  {name:'Linguado',kind:'fish',tier:'incomum',kg:[.5,2],diff:.4,rarity:8,price:35,shape:'flat',len:.45,top:0x7a6a50,side:0x9b8a68,belly:0xf1ede2,spots:true},
  {name:'Robalo',kind:'fish',tier:'raro',kg:[1.4,4.2],diff:.55,rarity:7,price:42,shape:'slim',len:.58,top:0x3d4a45,side:0xc2c9c4,belly:0xf1f1ec,line:true},
  {name:'Baiacu',kind:'fish',tier:'incomum',kg:[.3,1],diff:.35,rarity:6,price:0,fixed:6,shape:'puffer',len:.3,top:0x8a7a3a,side:0xd9c77a,belly:0xf4efd8,spots:true,note:'Não coma. Sério.'},
  {name:'Peixe-espada',kind:'fish',tier:'raro',kg:[1,3],diff:.5,rarity:5,price:30,shape:'ribbon',len:1.1,top:0xbfc8d0,side:0xe4eaee,belly:0xf5f7f8},
  {name:'Garoupa',kind:'fish',tier:'raro',kg:[3,8.5],diff:.72,rarity:4,price:48,shape:'deep',len:.62,top:0x5a3b27,side:0x8d6446,belly:0xd9c3a3,spots:true},
  {name:'Arraia',kind:'fish',tier:'epico',kg:[4,14],diff:.78,rarity:2.5,price:25,shape:'ray',len:.9,top:0x5a5f5a,side:0x6f756f,belly:0xf0f0ea,spots:true},
  {name:'Dourado',kind:'fish',tier:'epico',kg:[4,11],diff:.85,rarity:2.4,price:55,shape:'blunt',len:.85,top:0x2e7d5a,side:0xd8b93a,belly:0xf1e7a8,spots:true},
  {name:'Atum-azul',kind:'fish',tier:'lendario',kg:[20,60],diff:.95,rarity:.7,price:60,shape:'tuna',len:1.2,top:0x1d2f5a,side:0x9fb0c8,belly:0xeef2f6,finlets:true},
  {name:'Marlim-azul',kind:'fish',tier:'lendario',kg:[40,120],diff:1,rarity:.45,price:50,shape:'bill',len:1.6,top:0x1a3f7a,side:0x5d8fc8,belly:0xeef3f8,stripes:true},
  {name:'Bota velha',kind:'junk',tier:'lixo',kg:[.6,.6],diff:.15,rarity:4,fixed:0,shape:'boot',note:'Tamanho 42. Sem o par.'},
  {name:'Pneu',kind:'junk',tier:'lixo',kg:[7,9],diff:.45,rarity:2.2,fixed:0,shape:'tire',note:'Pesou mais que o peixe dos sonhos.'},
  {name:'Lata amassada',kind:'junk',tier:'lixo',kg:[.02,.02],diff:.08,rarity:3,fixed:.1,shape:'crushed',note:'Reciclagem paga dez centavos.'},
  {name:'Sacola plástica',kind:'junk',tier:'lixo',kg:[.01,.01],diff:.06,rarity:3,fixed:0,shape:'bag',note:'O mar agradece a limpeza.'},
  {name:'Alga gosmenta',kind:'junk',tier:'lixo',kg:[.2,.5],diff:.08,rarity:3,fixed:0,shape:'weed',note:'Tem cheiro de segunda-feira.'},
  {name:'Sunga perdida',kind:'junk',tier:'lixo',kg:[.1,.1],diff:.12,rarity:1.2,fixed:0,shape:'trunks',note:'De quem será? Melhor não perguntar.'},
  {name:'Controle remoto',kind:'junk',tier:'lixo',kg:[.2,.2],diff:.15,rarity:1,fixed:0,shape:'remote',note:'Explica o sumiço do controle da TV.'},
  {name:'Moeda antiga',kind:'treasure',tier:'raro',kg:[.02,.02],diff:.5,rarity:1.6,fixed:120,shape:'coin',note:'Réis de 1880. Colecionador paga bem.'},
  {name:'Relógio de ouro',kind:'treasure',tier:'epico',kg:[.15,.15],diff:.6,rarity:.8,fixed:450,shape:'watch',note:'Ainda funciona. Marca 18:47.'},
  {name:'Anel de noivado',kind:'treasure',tier:'epico',kg:[.01,.01],diff:.55,rarity:.5,fixed:800,shape:'ring',note:'Alguém disse não. Ou deixou cair.'},
  {name:'Garrafa com mensagem',kind:'treasure',tier:'raro',kg:[.4,.4],diff:.3,rarity:1.4,fixed:60,shape:'bottle',note:'message'},
  {name:'Baú do tesouro',kind:'treasure',tier:'lendario',kg:[18,18],diff:.9,rarity:.25,fixed:2500,shape:'chest',note:'O mapa estava certo o tempo todo.'},
  {name:'Lata de BALY',kind:'special',tier:'especial',kg:[.5,.5],diff:.35,rarity:3,fixed:8,shape:'baly',note:'30 segundos de energia em TUDO.'},
];
export const BALY=CATCHES.findIndex(c=>c.shape==='baly');
export const MESSAGES=['"Se achar isso, estou na ilha. Traga pão francês."','"Ana, me perdoa. Ass: o cara do barco."','"O tesouro está onde o farol não alcança."','"Aqui não tem sinal de celular. Socorro."','"Não confie nas gaivotas."','"Senha do wi-fi: peixe123"'];
export function catchValue(i,kg){const c=CATCHES[i];if(!c)return 0;return Math.round((c.fixed!==undefined?c.fixed:kg*c.price)*100)/100;}
export const money=v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
