# Digestivo Quest – Sala multijugador

Aplicación web real con **Node.js + WebSockets**. Contiene 36 laminarios basados en las tres clases de la Unidad IX, imágenes seleccionadas de las presentaciones, selección múltiple, ordenamiento, pareo y correspondencias, rebotes, puntuación y revelación de soluciones.

## Iniciar en una computadora

1. Instala Node.js 20 o superior.
2. Abre una terminal en esta carpeta.
3. Ejecuta `npm install` y luego `npm start`.
4. Abre `http://localhost:3000` en el navegador del docente.
5. Crea una sala y comunica el código de seis dígitos a los estudiantes.

**Celulares en la misma red Wi-Fi:** usa la dirección IP local de la computadora del docente, por ejemplo `http://192.168.1.20:3000` (es solo un ejemplo). La red debe permitir conexiones entre dispositivos y el firewall debe permitir el puerto 3000.

**Celulares desde cualquier red:** despliega esta carpeta en un servicio de alojamiento compatible con Node.js y conexiones WebSocket (por ejemplo, Render o Railway) y utiliza el enlace HTTPS público. Se requiere cuenta y despliegue por parte del docente; el ZIP por sí solo no crea una sala accesible en internet.

## Reglas

- El docente configura entre 1 y 240 minutos y pulsa «Iniciar competencia».
- El primer pulsador recibido por el servidor obtiene el turno. La latencia de red puede influir en el orden.
- El estudiante responde desde su celular; el servidor valida sin enviar las claves de respuesta anticipadamente.
- Si falla, queda excluido de ese laminario y se reabren los pulsadores. Si acierta, gana 10 puntos en el primer intento o 7 en un rebote.
- El docente revela la solución y avanza manualmente. Cuando se agota el tiempo, se revela la solución y se bloquea la competencia.
- Los estudiantes pueden recuperar su sesión tras recargar **en el mismo navegador**. Si el servidor se reinicia, las salas y los puntos se pierden.

## Consideraciones

- Es un prototipo funcional para uso docente, **no una plataforma de evaluación formal**. Los nombres no verifican identidades y no hay autenticación institucional.
- Para uso masivo conviene añadir persistencia en base de datos, controles antiabuso y pruebas de carga.
- Las imágenes provienen de las presentaciones de referencia; revisar visualmente cada asociación antes de usarla en clase.
- Las preguntas y sus soluciones se encuentran en `data/questions.json`; nunca publiques esta carpeta como estática.
