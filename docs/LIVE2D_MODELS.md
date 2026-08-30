# Catálogo de Modelos Live2D Cubism en Cristi AI

Referencia técnica de los 8 modelos Live2D integrados en Cristi AI.

---

## 1. Modelos Disponibles

| ID | Nombre | Universo / Temática | Parámetros | Expresiones | Movimientos | Voz Recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `yanderegirl` | **Cristi Gótica (Yandere Girl)** | Original / Cyber-Goth | 75 | `Yandere`, `Mad`, `Crazy`, `Scared` | `idle` | `Aoede` |
| `icegirl` | **Ice Girl (Cheongsam)** | Fantasy / Anime | 94 | 12 expresiones (Sonrojo, Alas, Ojos corazón) | `DaiJi`, `HuiShou`, `MeiYan` | `Kore` |
| `hiyori` | **Hiyori (Pro Cubism)** | Live2D Official Sample | 64 | Expresiones estándar | 8 animaciones motion3 | `Zephyr` |
| `miara` | **Miara (Pro Cubism)** | Live2D Official Sample | 65 | Expresiones estándar | 3 animaciones motion3 | `Leda` |
| `toki` | **Toki (Asuka)** | Blue Archive | 74 | Gestos y mirada | `idle` | `Despina` |
| `ellen` | **Ellen Joe** | Zenless Zone Zero | 207 | `black`, `red`, `shock`, `shou`, `tang` | `idle`, `idle2` | `Aoede` |
| `jane_doe` | **Jane Doe** | Zenless Zone Zero | 148 | `脸红`, `爱心眼`, `白眼`, `生气`, `血` | `Scene1` | `Fenrir` |
| `ruan_mei` | **Ruan Mei** | Honkai: Star Rail | 114 | Gestos refinados y físicas | `idle` | `Callirrhoe` |

---

## 2. Parámetros Estándar Universales

Cada modelo se mapea a los siguientes identificadores semánticos:
- `head_angle_x`, `head_angle_y`, `head_angle_z`: Inclinación de la cabeza.
- `body_angle_x`, `body_angle_y`, `body_angle_z`: Balanceo y postura corporal.
- `eye_l_open`, `eye_r_open`: Apertura y parpadeo de ojos.
- `eye_l_smile`, `eye_r_smile`: Ojos sonrientes.
- `eye_ball_x`, `eye_ball_y`: Seguimiento de la mirada.
- `brow_l_y`, `brow_r_y`, `brow_l_angle`, `brow_r_angle`: Expresión de cejas.
- `mouth_open_y`, `mouth_form`: Sincronización labial y modulación vocal.
- `breath`: Respiración continua.

---

## 3. Ocultamiento de Marcas de Agua (`hiddenParts`)
En modelos que contienen capas o textos superpuestos de distribución (como Ellen Joe), el perfil especifica:
```javascript
hiddenParts: ['Part17']
```
El motor `Live2DAdapter` fuerza automáticamente la opacidad de estas partes a `0` sin dañar el archivo binario del modelo.
