# El presidente y la bomba

Juego de fiesta para 6 a 20 jugadores en dos salas. El equipo azul protege al presidente; el rojo quiere que el bombardero acabe en su misma sala. Rondas cronometradas cada vez más cortas e intercambio de rehenes entre salas. Con código de sala, cada uno enseña su color o su carta desde el móvil.

🔗 **Jugar ahora:** https://adrianezd.github.io/el-presidente-y-la-bomba/

## Dos modos

- **Mismo móvil:** el móvil se pasa de mano en mano para las fases secretas y hace de narrador. Funciona sin conexión.
- **Con código de sala:** uno crea la sala y elige los ajustes; el resto entra con el código y cada uno juega en su móvil. Los móviles se comunican por [ntfy.sh](https://ntfy.sh) (sin cuentas), así que hace falta internet.

## Reglas

- Hasta 10 jugadores: tres rondas de 3, 2 y 1 minutos y un rehén por sala. Con más: cinco rondas y dos rehenes en las primeras.
- Espías opcionales (enseñan el color contrario) y apostador con número impar.

## Stack técnico

Sitio estático sin dependencias ni build: HTML, CSS y JavaScript vanilla servidos por GitHub Pages.

- `script.js`: el juego. Un único motor (`act`, `privateTurn`, `render`) para los dos modos.
- `mesa.js`: modo «Mismo móvil», igual en los juegos de fiesta por fases.
- `sala.js` y `sala.css`: modo con código de sala, iguales en todos los juegos de fiesta.
- `kit.js` y `style.css`: piezas y estilos comunes. `juego.css`: lo propio de este juego.
- `sw.js`: caché para jugar sin conexión.

## Aviso

Juego de fiesta **original**, no afiliado a ninguna marca, producto o juego comercial.
