# Entre peixes e Notas

Pescaria cooperativa em **primeira pessoa** para **2 a 5 jogadores**, em WebGL/Three.js. A partida começa com o barco amarrado no cais de Laguna, uma vila de pescadores. A tripulação pesca, carrega o balde até o supermercado para vender, defende o pescado das gaivotas ladras, toca violão e resgata quem cai no mar com a corda do barco. O jogo não acaba sozinho: o fim do mundo só começa quando o anfitrião aperta **TAB**. O modo de um jogador existe para testar os sistemas. Os rostos usam as fotos originais como textura projetada na malha da cabeça.

## Rodar

Requer Node.js 24.

```powershell
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. **Testar sozinho** inicia o teste solo. O jogo precisa de servidor HTTP: abrir `index.html` direto como arquivo não funciona. `atelier.html` é o visualizador dos modelos: os cinco personagens, barco, rifle, gaivota, padeiro, todos os pescados, os 20 moradores e uma prévia da primeira pessoa (com botões de atirar, recarregar e mirar). Para testar direto no jogo, abra `/?teste` (teste solo sem menu).

## Controles

| Ação | Controle |
| --- | --- |
| Olhar ao redor | Mouse (clique na tela para capturar o cursor) |
| Andar / acelerar e virar no leme | WASD ou setas |
| Correr · segurar a respiração na luneta | Shift |
| Pular | Espaço |
| Dar um tapa · mirar com a luneta (com rifle) | Botão direito |
| Atirar (com rifle) | Botão esquerdo |
| Usar o que está na mira (leme, rifle, balde, corda, violão, peixaria, padeiro, caixas): o aviso "E" aparece em cima do objeto · largar o que está na mão | E |
| Girar o laço e soltar (com a corda) | Botão esquerdo, duas vezes |
| Barra de itens: escolher · usar o item escolhido | 1–0 ou rodinha · botão esquerdo |
| Passar o item no leitor do autoatendimento | segurar E olhando o leitor |
| Nadar · mergulhar · subir no barco ou no cais (na água) | WASD · Shift · Espaço |
| Tocar o violão | D F J K |
| Espantar a gaivota que agarrou o balde (segurar) | F |
| Lançar, fisgar e recolher (segurar) | F |
| Tela de eventos (só o anfitrião, segurar): tempestade, Nessie, meteoro | TAB |
| Liberar o cursor e abrir as opções | Esc |

## A ilha

No centro do mapa fica **Laguna**, uma vila no estilo açoriano do litoral catarinense:

- cais de madeira com estacas, cabeços de amarração, lampiões, boia salva-vidas e o pórtico "Laguna";
- calçadão de pedra portuguesa com guarda-corpo, escadas para a areia e quiosque de água de coco;
- rua de paralelepípedo com calçadas, orelhão, postes coloniais e casas coloridas, com venezianas, floreiras, cercas e buganvílias;
- a travessa da Figueira, à esquerda do mercado, com mais cinco casas;
- praça com chafariz e ipês-amarelos, e uma igrejinha com torre sineira;
- praia com coqueiros, guarda-sóis, canoas e ranchos de pesca;
- morro com araucárias e o farol, com lente de Fresnel girando, dois fachos com poeira no ar, clarão quando o facho passa por quem olha e um holofote que varre o mar;
- 20 moradores (dá para dar tapa neles: viram ragdoll e voltam ao caminho) com roupas, chapéus (palha, pescador, gorro, panamá, boné) e acessórios variados, andando pelas ruas, pelo calçadão, pela praça e pelo cais. O caminho de cada um sai do relógio da partida, então todos os jogadores veem as mesmas pessoas no mesmo lugar. Os rostos são retratos pintados no próprio jogo. Mais tarde eles vão dar missões.

A vegetação e a grama balançam com o vento, que fica mais forte na tempestade. No shader do mar, o fundo da ilha deixa a água rasa turquesa, e as marolas correm para a praia e quebram com espuma.

O **supermercado** é inspirado nas lojas Althoff: paredes amarelo-limão, faixa de telha metálica ondulada azul, oval amarelo com o logo, marquise branca, totem na praça, carrinhos e portas automáticas. Por dentro há:

- gôndolas cheias, hortifrúti, geladeiras de frios e uma pirâmide de latas de Baly;
- a **peixaria**, onde se vende o balde inteiro com **E**. O balde precisa estar ali: alguém pega o balde no barco (E) e carrega até a peixaria;
- a **padaria**, com "O pescador" trabalhando de padeiro. Com **E**, ele diz "É... Tenho que sair aqui" (todos por perto veem o diálogo sendo digitado) e some numa nuvem de fumaça, com o som de quem sai da chamada. Dez segundos depois ele volta pela porta da loja. O tapa ainda funciona: ele vira ragdoll, levanta e volta andando ao balcão;
- quatro **caixas de autoatendimento** sem operador (a compra de itens entra numa próxima versão).

Andar pela borda do barco não derruba ninguém na água: a borda é uma parede. Só se passa para o cais ou para a praia quando há chão firme ao lado. O barco colide com a ilha e com o cais.

## Corda, deriva e resgate

- **Deriva:** sem ninguém no leme e sem corda, o barco anda sozinho com o mar. Na tempestade ele vai longe.
- **Atracar:** a corda fica enrolada na proa. Com ela na mão, mire num cabeço do cais e clique: o laço começa a girar sobre a cabeça. Clique de novo quando o laço estiver na frente (faixa verde). Quanto mais longe, menor a faixa, até o limite de 24 m. Acertando, a corda voa em arco e amarra no cabeço, com física de corda. **E** no cunho da proa ou no cabeço solta de novo.
- **Morrer e reviver:** o tapa só derruba, e a pessoa levanta onde caiu. Cair no mar é o que conta: o corpo ainda voa no primeiro contato com a água e depois fica boiando. Quem está à deriva tem **20 segundos** (barra na tela) para ser laçado com o mesmo minigame da corda. Laçado, é puxado até quem segura a corda e levanta no barco. Se ninguém laçar a tempo, acorda no cais de Laguna. Dá também para nadar sozinho até o casco, o cais ou a praia e subir com Espaço. Não existe vida nem frio: o único jeito de "morrer" é ficar à deriva.
- **Barco abandonado:** se ninguém estiver a bordo por 10 s e o barco estiver longe do cais, ele reaparece amarrado no cais.

## Pesca

São 25 coisas na linha, em raridades **comum, incomum, rara, épica e lendária**:

- **Peixes:** sardinha, tainha, corvina, pargo-rosa, linguado, robalo, baiacu, peixe-espada, garoupa, arraia, dourado, atum-azul e marlim-azul.
- **Tesouros:** moeda antiga, relógio de ouro, anel de noivado, garrafa com mensagem e baú.
- **Lixo:** bota, pneu, lata, sacola, alga, sunga perdida e controle remoto.
- **Especial:** a **lata de BALY** (rótulo preto e amarelo do Baly Tradicional), que dá 30 segundos de velocidade em tudo — andar, pular, recolher a linha e atirar. Durante o efeito, a tela fica frenética: matiz girando, pulso na batida, linhas de velocidade e uma batida eletrônica.

O minigame mostra a raridade de quem está na linha. Manter a marca na faixa verde enche um **combo** que acelera o progresso. A interface tem o "!" gigante da fisgada, cartão de captura com raios na cor da raridade, confete, valor em reais e "novo recorde" ou "novo no álbum". A venda solta moedas e o contador de dinheiro vai rolando.

## Balde e gaivotas no cabo de guerra

O balde é uma peça solta: fica no convés, na mão de alguém ou no chão. Largado no chão, ele ganha um marcador amarelo na tela (com a distância), como o das gaivotas. As gaivotas vão atrás dele onde estiver. Se uma gaivota agarrar o balde enquanto alguém o segura, começa um cabo de guerra: segure **F** para manter a marca numa faixa que foge o tempo todo, antes que a garra da gaivota encha. É difícil de propósito. Os amigos podem atirar nela durante a briga, e o rifle continua sendo a melhor arma.

## Violão

O violão fica no banco do meio do barco. Com **E**, quem pega vira a banda da partida: a trilha automática saiu, e a música agora é o que alguém toca. Primeiro aparece a lista de músicas (**W/S** escolhe, **ENTER** toca, **Q** volta à lista), cada uma marcada como **fácil, médio, difícil ou extremo**. São quatro trilhas (D F J K) com notas caindo numa estrada em perspectiva, janela de acerto folgada, combo, multiplicador até x4 (as bordas da estrada acendem), explosões nos acertos e avisos de combo. No fim, a nota em estrelas fica guardada na lista.

- **Fácil:** Brilha, Brilha, Estrelinha · Rema, Rema, Remador (Row, Row, Row Your Boat) · Frère Jacques · Canção do Pescador (original)
- **Médio:** Ode à Alegria (Beethoven) · Meu Bem Está Além do Mar (My Bonnie) · O Marinheiro Bêbado (Drunken Sailor, cantiga de marinheiro e pirata)
- **Difícil:** Scarborough Fair · Greensleeves · Saque em Laguna (shanty de pirata original)
- **Extremo:** Laguna ao Entardecer (original) · No Salão do Rei da Montanha (Grieg, acelera até o fim) · Cavalgada das Valquírias (Wagner, mitologia nórdica)

Todas são de domínio público ou composições do jogo; músicas de filmes e séries (como as de piratas e vikings famosas) têm direitos autorais e ficaram de fora. O som é posicional: quem está perto ouve bem, e quem está longe ouve cada vez menos. Nas opções há volume do jogo, volume da música (violão) e sensibilidade do mouse.

## Rifles e gaivotas

Dois rifles de ferrolho ficam no suporte do barco. O modelo tem peças que se movem: o ferrolho gira e corre, o carregador é destacável, e há luneta com torres, anéis, lentes e bandoleira. Em primeira pessoa, as duas mãos seguram a arma (IK de dois ossos): uma no punho, outra no guarda-mão. Depois de cada tiro a mão direita manobra o ferrolho e a cápsula é ejetada. A recarga é animada:

1. a arma gira;
2. o carregador cai;
3. a mão busca outro e o encaixa com um tapa;
4. o ferrolho é manobrado.

O tiro tem estalo, estrondo, cauda e ecos na água, além de clarão em estrela, fumaça e luz. A luneta aproxima 5x, tem retículo duplex e reduz a sensibilidade do mouse; a respiração balança a mira e Shift a segura. Em terceira pessoa, os outros veem a coronha no ombro e as duas mãos por IK. O rifle é desenhado numa camada própria e nunca atravessa paredes.

As gaivotas circulam bem alto e **não podem ser atingidas** enquanto circulam. Só a **ladra** pode: ela é marcada na tela (com seta na borda quando está fora de vista), mergulha em direção ao balde, paira pegando o peixe e foge devagar, pesada, carregando o peixe. Se for abatida sobre o barco, o peixe volta para o balde. Na tempestade elas não atacam.

## Clima e eventos

- **Tempestades naturais:** a cada 4–5 minutos de calmaria chega uma tempestade de 2 minutos (vento, chuva, raios e ondas grandes).
- **Nessie:** na segunda tempestade (e a cada duas depois disso), a Matriarca do Abismo espera em mar aberto: leve o barco a mais de 150 m de Laguna enquanto a tempestade durar. Na luta, a tempestade continua até ela morrer. São três estágios, 800 de vida e nove ataques sem marcas na tela (lidos pela animação e pelo som). Os rifles acertam até debaixo d'água: olhos ×5, garganta ×3, guelras ×2, corpo ×1 e espinhos ×0,25. Todo golpe que acerta o barco (investida, cauda, mordida, jato, espinhos, parede de água de frente) derruba exatamente um pescador no mar; barco parado apanha a cada ~13 s. Vencer rende R$ 1.000.
- **Eclipse (TAB, só o anfitrião):** o fim da partida, igual ao do sacrifício: o Eclipse do Coração e, quando ele termina, o meteoro cai em Laguna.
- **Comandos de teste (TAB, só o anfitrião):** teleporte (deque de Laguna, entrada da Ilha do Vulcão, escadaria do templo, níveis 1 a 4 do templo, beiral da cratera, topo da cachoeira, para dentro do barco), modo voar (rodinha muda a velocidade, ESPAÇO sobe, C desce, SHIFT turbo), barco no deque ou na boca do rio do vulcão, instalar todas as melhorias, + R$ 5.000, kit de itens, tempestade agora, acalmar, Nessie agora, derrotar a Nessie e abrir/fechar os portões do templo, abrir/fechar o portão de cada nível, pegar o Coração do Vulcão, o Eclipse do Coração (só o espetáculo, sem meteoro) e reiniciar os puzzles. Valem para todos os pescadores, a não ser que "Afetar apenas o anfitrião" esteja marcado (barco, dinheiro e clima são sempre da tripulação).

## Ilha do Vulcão

Bem longe de Laguna, na direção para onde a doca aponta (uns 800 m). Não tem ninguém morando: praias de areia preta, selva fechada, um vulcão aceso com fumaça e rio de lava antigo.
- **Rio navegável:** a boca fica na costa norte; o barco sobe o rio, passa por baixo da ponte de cordas e chega à lagoa com cachoeira e píer de pedra.
- **Trilhas no mato:** da praia norte e do píer da lagoa até o templo, do templo até a borda da cratera (subida em zigue-zague com rampa suave), até o topo da cachoeira e uma travessia pela ponte de cordas. A calçada do templo fica rente ao chão. Há ruínas no caminho (colunas, muros, guardiões, uma estela).
- **Templo do Coração do Vulcão:** pirâmide de três degraus com escadaria, serpentes, frisos de glifos, máscaras de pedra, santuário no topo e calçada com guardiões e braseiros. Pelo santuário desce-se a um complexo subterrâneo iluminado por tochas: Salão dos Dardos (placas de pressão, paredes furadas), Fosso das Lanças (ponte de uma pedra só), Galeria das Lâminas, Câmara dos Pilares (pilares de glifos e a porta selada), Rampa da Pedra (a bola gigante), Sala dos Espelhos (feixe de luz e disco solar), Sala dos Ladrilhos (glifos sobre canais de lava) e a Câmara do Coração, com o ídolo, o altar e o artefato. Armadilhas e puzzles ainda estão só na estrutura; o funcionamento e o artefato jogado no vulcão vêm depois.
- **Níveis do templo:** do santuário no topo (altar de oferendas, serpentes, murais) desce uma escada para quatro níveis. Cada um tem um mural com a pista e termina num portão de pedra que só sobe quando o puzzle é resolvido; aberto, fica aberto para toda a tripulação (o estado é do anfitrião).
  - **Nível 1 · Salão dos Dardos:** todo ladrilho tem um glifo, mas só os da lua (☽) são seguros e formam um caminho sem diagonais. Pisar em outro glifo dispara os dardos das duas paredes. Quem chega na placa diante do portão ergue a pedra, e os dardos travam.
  - **Nível 2 · Fosso das Lanças e Galeria das Lâminas:** ponte estreita sobre o fosso (a rampa de pedra do fundo só devolve para a entrada). Depois, quatro lâminas balançando, cada uma com um glifo: acertam quem passa na hora errada. No fim da galeria há quatro botões de glifo; apertados na ordem das lâminas (da entrada para o fundo), abrem o portão. Um erro zera a sequência.
  - **Nível 3 · Câmara dos Pilares e Sala dos Espelhos:** a luz do poço desce no canto e segue pelo chão. E gira um espelho 45°: de frente a luz morre, de lado ela passa rente, na diagonal ela vira. Quando o feixe chega ao disco solar da parede leste, o portão sobe.
  - **Nível 4 · Câmara do Coração:** suba o estrado e pegue o **Coração do Vulcão** (E).
  - **Armadilhas:** dardos, lanças e lâminas derrubam em ragdoll; o jogador levanta no **início do nível** (não vai para Laguna). A escada do santuário desce por um túnel escavado na pirâmide e no morro.
- **O artefato e o sacrifício:** quem pega o Coração leva ele na mão (slot brilhante na barra de itens). Todos veem o objetivo no topo da tela e o marcador do **Beiral do Sacrifício** com a distância (preso à borda da tela quando está fora da vista). O céu se abre na direção de Laguna. Quem estiver com o Coração tem que cair na lava: pular da ponta do Beiral ou levar um tapa de um amigo. Quem cai na lava morre e acorda no cais de Laguna; se era o portador, é o sacrifício: a lava explode, o barco vai para a praia norte da Ilha do Vulcão e começa o **Eclipse do Coração**, e do fim dele nasce **o meteoro que cai em Laguna**. Dali vêm o impacto, a tsunami e a cutscene final. Se o portador sair da partida, o Coração volta ao altar.
- **Cachoeira:** três cortinas d'água curvas com fluxo animado, rio no topo, rochas molhadas e cipós, poça com espuma, respingos, névoa e arco-íris.
- **Topo do vulcão:** lava viva na cratera, fluxo de lava, brasas e jorros, torres de basalto, fumarolas de enxofre com vapor, fumaça em duas camadas e o **Beiral do Sacrifício** (plataforma com altar, arco e braseiros sobre a cratera).
- **Eclipse do Coração (~36 s, sincronizado):** um feixe de luz sobe da cratera e o sol volta a subir; a lua avança sobre ele e a escuridão chega pelo céu a partir do lado do sol, com anel de crepúsculo em todo o horizonte. Surgem estrelas, a Via Láctea colorida e nebulosas. No segundo contato vêm as contas de Baily e o anel de diamante; na totalidade, a coroa animada com raios de cores, proeminências, auroras e estrelas cadentes. A lua só aparece onde cobre o sol (antes disso ela é invisível, como uma lua nova de dia). Anéis de runas sobem girando pelo feixe e a constelação do Coração (◈) é desenhada estrela por estrela. Seis planetas (Saturno com anéis) deslizam até se alinhar: no alinhamento acendem um fio de luz até o eclipse, um vórtice espiral de cores, o círculo de runas, ondas de halo, pilares de luz na borda da cratera, uma onda de luz correndo pelo mar e uma chuva de meteoros. No terceiro contato, outro anel de diamante; a luz volta e o céu sangra vermelho com o meteoro. Trilha épica própria (score.js, Ré menor a 90 BPM: taikos, metais, coro, cordas, gongo e sinos em quatro atos, com clímax em Ré maior no alinhamento); a música normal abaixa durante ela. O mar reflete tudo. Tempestade e Nessie ficam suspensas durante o eclipse.
- **Altura e horizonte:** Laguna e a Ilha do Vulcão se enxergam uma da outra (a névoa vai até ~1,2 km e o mar acaba em névoa antes da borda). Do alto, o mar ganha bruma mais cedo (esconde a repetição das ondas) e, quanto mais alto você sobe mais nuvens aparecem abaixo, escondendo a borda do mundo.

## Mercado Althoff e Loja do Pescador

- **Carrinhos (estilo REPO):** ficam no abrigo ao lado da entrada. **E** no puxador pega; ele vai na frente e balança nas curvas. Dá para pegar carona no carrinho de outro pescador (E nele; Espaço desce).
- **Loja do Pescador:** 45 itens (preços do mercado de verdade: caros) em dois expositores e na vitrine de iscas, cada um com modelo 3D, etiqueta de preço e a regra do que faz (aparece ao olhar). **E** num item joga no carrinho que você empurra, ou pega na mão.
- **Autoatendimento:** segure **E** olhando o leitor para passar um item por vez (o laser acende e a tela lista tudo). **E** na maquininha paga com o caixa da tripulação; a impressora solta o cupom. Sem saldo, a tela avisa.
- **A porta não deixa sair nada sem pagar:** nem o carrinho, nem o item na mão.
- **Depois de pagar:** tudo vai para a mochila (8 espaços; 12 com a mochila estanque). **Melhorias do barco** (sonar, rádio, barômetro, âncora, guincho, motor, hélice, leme, bateria, âncora de deriva, lampião) se instalam uma por vez: com a melhoria na mochila, segure **E** olhando o barco. Ela aparece no convés. Se o barco reaparecer no cais (abandonado), as melhorias instaladas se perdem.
- **O que os itens fazem:**
  - pesca: vara (11 m), carretilha, linha, iscas, passaguá, bicheiro, arpão, faca, alicate, balança, sonda, ceva, armadilha de lagosta;
  - navegação: sonar, rádio, barômetro, bússola, carta náutica, sextante, luneta, boia sinalizadora, câmera (fotos pagas);
  - barco: motor com combustível, hélice antialgas (há algas perto da ilha), leme, âncora, âncora de deriva, guincho, bateria, lampião;
  - água: colete, nadadeiras, cilindro de mergulho (tesouros no fundo), lanterna;
  - Nessie: arpão (prende 8 s), chamariz, chocalho, hidrofone, sinalizador.
- **Sem vida, frio, casco ou alagamento:** kit médico, garrafa térmica, kit de reparos, bomba de porão e barraca saíram da loja.

## O fim

O fim vem pelo sacrifício do Coração do Vulcão (veja a Ilha do Vulcão) ou quando o anfitrião escolhe Eclipse no TAB. Nos dois casos vem primeiro o Eclipse do Coração e, quando ele termina, o meteoro. Todos recebem o aviso. O céu vira tempestade vermelha, o meteoro vem por cima do barco e cai no meio da ilha. Tudo vai pelos ares: casas, a igreja, o farol, painéis do mercado, árvores, tábuas do cais e pedaços de terra com grama, que caem no mar levantando respingos. No lugar fica uma cratera submersa. Quem estiver em terra em Laguna voa junto (quem está na Ilha do Vulcão assiste de longe). Depois vêm a tsunami, a cutscene dos dois primeiros personagens e o apagão sincronizado com a onda.

## Multiplayer

O anfitrião é a autoridade sobre barco, pesca, gaivotas, venda, padeiro, tapas e relógio. Cada jogador controla o próprio movimento (no barco ou em terra) com predição local.

- **Sala com código:** um jogador cria a sala e passa o código de 5 letras; até 4 amigos entram com ele.
- **Conexão manual:** para 2 jogadores, sem servidor de salas.
- **Duas abas:** teste local no mesmo navegador.

A sinalização usa o servidor público do PeerJS e os dados vão direto entre os navegadores (WebRTC com STUN). **Não há servidor TURN.** Ao entrar numa sala, três caminhos correm ao mesmo tempo e vale o primeiro que abrir:

1. **Direto:** quem entra liga para o anfitrião.
2. **Chamada invertida:** se a ligação não abre em 5 s, o anfitrião liga de volta. Em algumas redes só funciona a ligação que o outro lado começa; era o caso de "ele entra na minha sala, mas eu não entro na dele".
3. **Ponte:** qualquer convidado já conectado repassa os pacotes e também liga de volta se precisar.

O lobby mostra o diagnóstico da sua rede, por exemplo "NAT comum", "NAT simétrico/CGNAT" ou "muitos adaptadores virtuais".

## Desempenho

Um contador de FPS discreto fica no canto superior direito.

Distância: Laguna aparece da Ilha do Vulcão, mas de longe o mercado (interior, prateleiras e produtos, ~580 chamadas de desenho) vira uma caixa simples e a grama some além de 300 m; antes o mercado sozinho derrubava o jogo para ~20 FPS olhando de longe.

Física dos corpos: os milhares de colisores estáticos (troncos, colunas, casas) ficam fora do mundo do Cannon, numa grade; só entram os que estão a até 12 m de um corpo caído. Antes eram 2.367 corpos no broadphase (~23 ms por passo), e um ragdoll na lâmina ou no mar levava o jogo a subpassos e travava.

 (se um corpo atravessa uma parede, volta para a última posição boa) a superfície das ilhas é um heightfield grosso; as salas do templo têm um heightfield próprio de 0,5 m (a rocha vira parede), e só os corpos que caem lá dentro enxergam esse chão (grupos de colisão), então ninguém atravessa o piso nem vai parar no morro de cima.

Otimizações: cada objeto só é desenhado se estiver na frente da câmera; a vegetação da Ilha do Vulcão é instanciada com LOD (modelo completo de perto, copa simples mais longe, nada além da névoa) e o templo de dentro só existe com a câmera por perto; Laguna inteira some quando você está longe (e as peças pequenas somem antes das grandes). As luzes nunca mudam de quantidade (as da ilha e da Nessie ficam fixas na cena e só apagam pela intensidade); se mudassem, o three.js recompilaria todos os materiais no meio do jogo, que era o engasgo do meteoro, da explosão e da Nessie. As malhas estáticas da ilha são juntadas por material, o interior do mercado só é desenhado de perto e moradores longe não projetam sombra. Qualidade **Alta** usa resolução até 1,5×, sombras de 2048 px que acompanham o jogador, pós-processamento completo e SMAA. **Leve** reduz resolução, sombras, grama e partículas. Os shaders do clímax são compilados no carregamento.

## GitHub Pages

```powershell
npm test
npm run build
```

O workflow `.github/workflows/pages.yml` testa, gera e publica a cada push na branch `main`. As fotos dos rostos ficam públicas no site.

## Organização

- `src/core.js`: regras, lobby, pesca (combo e Baly), tempo de história, clima, ondas e protocolo.
- `src/catalog.js`: tudo o que pode ser pescado (raridade, valor, peso).
- `src/terrain.js`: altura da ilha, cais, lotes, mercado e chão caminhável.
- `src/island.js`: terreno, vila, cais, vegetação com vento, grama, farol e a explosão da ilha.
- `src/shop.js`: supermercado (fachada, gôndolas, peixaria, padaria, caixas).
- `src/weapons.js`: rifle, braços em primeira pessoa, recarga, luneta e traçante.
- `src/gulls.js`: gaivotas ladras.
- `src/main.js`: partida, movimento barco/terra, itens (balde, corda, violão), resgate, padeiro, rede, câmera, cutscene e HUD.
- `src/rope.js`: corda com física de Verlet (laço, arremesso, amarração, resgate).
- `src/guitar.js`: minigame do violão e as músicas.
- `src/npcs.js`: moradores de Laguna e os retratos pintados.
- `src/fish.js`, `src/characters.js`, `src/boat.js`: modelos procedurais.
- `src/environment.js`, `src/cataclysm.js`, `src/fluid.js`, `src/post.js`, `src/shaders.js`: céu, mar, meteoro, fluido e pós-processamento.
- `src/animation.js`: animação procedural, IK dos braços e olhar entre personagens.
- `src/physics.js`: ragdolls (barco, ilha e padeiro).
- `src/audio.js`: áudio procedural.
- `tests/`: regras, ilha, pesca, gaivotas, física e sincronia do final.
