#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <AccelStepper.h>
#include <string.h>

// ============================================================
// FORÓPTERO FIRMWARE v0.5.4 release 2
// ============================================================
// Basado en: Foroptero_v0_5_3_release_1.ino (baseline sin cambios de velocidad)
//
// Changelog vs v0.5.3 release 1:
//   - Perfil esférico dedicado (Fase B, Ítem 3): controlCD / controlCI
//   - ESFERA_MAX_SPEED 2400, ESFERA_ACCELERATION 1500 (×3,0 vs baseline; QA 2026-07-06)
//   - Banco: ~3,7 s / ±0,50 D; ~2,6 s / ±0,25 D; sin limitación TPM
//   - Cilindro, ángulo y oclusión sin cambio (800 / 500)
//   - Evidencia: registros-examen/examen-registro-20.csv (§4.0.10 plan)
//   - Plan: PLAN_FEEDBACK_CLIENTE_EXAMEN.md §2.5.11
// ============================================================

// ============================================================
// 🔧 CONFIGURACIÓN WIFI + MQTT
// ============================================================
const char* ssid = "DuoCasa";
const char* password = "01431931344";

const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* topicSub = "foroptero01/cmd";
const char* topicPub = "foroptero01/state";
const char* tokenEsperado = "foropteroiñaki2022#";
unsigned long lastPublish = 0;  // guarda el momento del último publish MQTT
const unsigned long PING_INTERVAL = 30000; // 30 segundos
bool ejecutandoMovimientoSecuencial = false;  // Bandera para evitar movimientos simultáneos


WiFiClient espClient;
PubSubClient client(espClient);

// ============================================================
// ⚙️ HARDWARE Y VARIABLES
// ============================================================
#define DIR_PIN 21

// PINES LADO DERECHO
#define STEP_C_R 33   // Esférico Derecho
#define STEP_B_R 19   // Cilíndrico Derecho
#define STEP_A_R 32   // Cilíndrico Derecho - Ángulo
#define STEP_D_R 22   // Oclusión Derecho

// PINES LADO IZQUIERDO
#define STEP_C_L 27   // Esférico Izquierdo
#define STEP_B_L 25   // Cilíndrico Izquierdo
#define STEP_A_L 26   // Cilíndrico Izquierdo - Ángulo
#define STEP_D_L 23   // Oclusión Izquierdo

const int pasosMotor = 200;
const int microstepping = 16;
const int pasosPorVuelta = pasosMotor * microstepping;

// Perfil esférico (Fase B — Ítem 3): solo controlCD / controlCI
// Validado banco 2026-07-06: ~3,7 s / ±0,50 D; ~2,6 s / ±0,25 D (registro-20).
// Baseline v0.5.3: 800 / 500 (~7 s / 0,50 D).
const float ESFERA_MAX_SPEED     = 2400;
const float ESFERA_ACCELERATION  = 1500;
const float OTROS_MAX_SPEED      = 800;
const float OTROS_ACCELERATION   = 500;

const int pasosPor025D = 640;  // Pasos por cada 0.25 dioptrías para cilindros
const float pasosPorGrado = pasosPorVuelta / 360.0;  // Pasos por grado para ángulo de cilindros
// Posiciones absolutas de oclusión en micropasos (sin cálculos de redondeo)
const long oclusionClose_R = 0;   // Cerrado Derecho: 0 micropasos
const long oclusionClose_L = 0;   // Cerrado Izquierdo: 0 micropasos
const long oclusionOpen_R = -311;  // Abierto Derecho: 311 micropasos (35°, punto de partida - ajustar si es necesario)
const long oclusionOpen_L = -311;  // Abierto Izquierdo: 311 micropasos (35°, punto de partida - ajustar si es necesario)

// Mapas de lentes esfericos
struct MapaC { float dioptria; long pasos; };
MapaC mapaC_pos_D[] = {
  { -19.00, -214694 }, { -18.75, -211850 }, { -18.50, -209006 }, { -18.25, -206162 }, { -18.00, -203318 }, { -17.75, -200474 }, { -17.50, -197630 }, { -17.25, -194786 }, { -17.00, -191942 }, { -16.75, -189098 }, { -16.50, -186254 }, { -16.25, -183410 }, { -16.00, -180566 }, { -15.75, -177722 }, { -15.50, -174878 }, { -15.25, -172034 }, { -15.00, -169190 }, { -14.75, -166346 }, { -14.50, -163502 }, { -14.25, -160658 }, { -14.00, -157814 }, { -13.75, -154970 }, { -13.50, -152126 }, { -13.25, -149282 }, { -13.00, -146438 }, { -12.75, -143594 }, { -12.50, -140750 }, { -12.25, -137906 }, { -12.00, -135062 }, { -11.75, -132218 }, { -11.50, -129374 }, { -11.25, -126530 }, { -11.00, -123686 }, { -10.75, -120842 }, { -10.50, -117998 }, { -10.25, -115154 }, { -10.00, -112310 }, { -9.75, -109466 }, { -9.50, -106622 }, { -9.25, -103778 }, { -9.00, -100934 }, { -8.75, -99440 }, { -8.50, -96596 }, { -8.25, -93752 }, { -8.00, -90908 }, { -7.75, -88064 }, { -7.50, -85220 }, { -7.25, -82376 }, { -7.00, -79532 }, { -6.75, -76688 }, { -6.50, -73844 }, { -6.25, -71000 }, { -6.00, -68156 }, { -5.75, -65312 }, { -5.50, -62468 }, { -5.25, -59624 }, { -5.00, -56780 }, { -4.75, -53936 }, { -4.50, -51092 }, { -4.25, -48248 }, { -4.00, -45404 }, { -3.75, -42560 }, { -3.50, -39716 }, { -3.25, -36872 }, { -3.00, -34028 }, { -2.75, -31184 }, { -2.50, -28340 }, { -2.25, -25496 }, { -2.00, -22652 }, { -1.75, -19808 }, { -1.50, -16964 }, { -1.25, -14120 }, { -1.00, -11176 }, { -0.75, -8432 }, { -0.50, -5588 }, { -0.25, -2744 }, { 0.00, 0 }, { 0.25, 2844 }, { 0.50, 5688 }, { 0.75, 8532 }, { 1.00, 11276 }, { 1.25, 14120 }, { 1.50, 16964 }, { 1.75, 19808 }, { 2.00, 22652 }, { 2.25, 25496 }, { 2.50, 28340 }, { 2.75, 31184 }, { 3.00, 34028 }, { 3.25, 36872 }, { 3.50, 39716 }, { 3.75, 42560 }, { 4.00, 45404 }, { 4.25, 48248 }, { 4.50, 51092 }, { 4.75, 53936 }, { 5.00, 56780 }, { 5.25, 59624 }, { 5.50, 62468 }, { 5.75, 65312 }, { 6.00, 68156 }, { 6.25, 71000 }, { 6.50, 73844 }, { 6.75, 76688 }, { 7.00, 79532 }, { 7.25, 82376 }, { 7.50, 85220 }, { 7.75, 88064 }, { 8.00, 90908 }, { 8.25, 93752 }, { 8.50, 96596 }, { 8.75, 99440 }, { 9.00, 102284 }, { 9.25, 105128 }, { 9.50, 107972 }, { 9.75, 110816 }, { 10.00, 113660 }, { 10.25, 116504 }, { 10.50, 119348 }, { 10.75, 122192 }, { 11.00, 125036 }, { 11.25, 127880 }, { 11.50, 130724 }, { 11.75, 133568 }, { 12.00, 136412 }, { 12.25, 139256 }, { 12.50, 142100 }, { 12.75, 144944 }, { 13.00, 147788 }, { 13.25, 150632 }, { 13.50, 153476 }, { 13.75, 156320 }, { 14.00, 159164 }, { 14.25, 162008 }, { 14.50, 164852 }, { 14.75, 167696 }, { 15.00, 170540 }, { 15.25, 173384 }, { 15.50, 176228 }, { 15.75, 179072 }, { 16.00, 181916 }, { 16.25, 184760 }, { 16.50, 187604 }
};
MapaC mapaC_pos_I[] = {
  { -19.00, -214694 }, { -18.75, -211850 }, { -18.50, -209006 }, { -18.25, -206162 }, { -18.00, -203318 }, { -17.75, -200474 }, { -17.50, -197630 }, { -17.25, -194786 }, { -17.00, -191942 }, { -16.75, -189098 }, { -16.50, -186254 }, { -16.25, -183410 }, { -16.00, -180566 }, { -15.75, -177722 }, { -15.50, -174878 }, { -15.25, -172034 }, { -15.00, -169190 }, { -14.75, -166346 }, { -14.50, -163502 }, { -14.25, -160658 }, { -14.00, -157814 }, { -13.75, -154970 }, { -13.50, -152126 }, { -13.25, -149282 }, { -13.00, -146438 }, { -12.75, -143594 }, { -12.50, -140750 }, { -12.25, -137906 }, { -12.00, -135062 }, { -11.75, -132218 }, { -11.50, -129374 }, { -11.25, -126530 }, { -11.00, -123686 }, { -10.75, -120842 }, { -10.50, -117998 }, { -10.25, -115154 }, { -10.00, -112310 }, { -9.75, -109466 }, { -9.50, -106622 }, { -9.25, -103778 }, { -9.00, -100934 }, { -8.75, -99440 }, { -8.50, -96596 }, { -8.25, -93752 }, { -8.00, -90908 }, { -7.75, -88064 }, { -7.50, -85220 }, { -7.25, -82376 }, { -7.00, -79532 }, { -6.75, -76688 }, { -6.50, -73844 }, { -6.25, -71000 }, { -6.00, -68156 }, { -5.75, -65312 }, { -5.50, -62468 }, { -5.25, -59624 }, { -5.00, -56780 }, { -4.75, -53936 }, { -4.50, -51092 }, { -4.25, -48248 }, { -4.00, -45404 }, { -3.75, -42560 }, { -3.50, -39716 }, { -3.25, -36872 }, { -3.00, -34028 }, { -2.75, -31184 }, { -2.50, -28340 }, { -2.25, -25496 }, { -2.00, -22652 }, { -1.75, -19808 }, { -1.50, -16964 }, { -1.25, -14120 }, { -1.00, -11176 }, { -0.75, -8432 }, { -0.50, -5588 }, { -0.25, -2744 }, { 0.00, 0 }, { 0.25, 2844 }, { 0.50, 5688 }, { 0.75, 8532 }, { 1.00, 11276 }, { 1.25, 14120 }, { 1.50, 16964 }, { 1.75, 19808 }, { 2.00, 22652 }, { 2.25, 25496 }, { 2.50, 28340 }, { 2.75, 31184 }, { 3.00, 34028 }, { 3.25, 36872 }, { 3.50, 39716 }, { 3.75, 42560 }, { 4.00, 45404 }, { 4.25, 48248 }, { 4.50, 51092 }, { 4.75, 53936 }, { 5.00, 56780 }, { 5.25, 59624 }, { 5.50, 62468 }, { 5.75, 65312 }, { 6.00, 68156 }, { 6.25, 71000 }, { 6.50, 73844 }, { 6.75, 76688 }, { 7.00, 79532 }, { 7.25, 82376 }, { 7.50, 85220 }, { 7.75, 88064 }, { 8.00, 90908 }, { 8.25, 93752 }, { 8.50, 96596 }, { 8.75, 99440 }, { 9.00, 102284 }, { 9.25, 105128 }, { 9.50, 107972 }, { 9.75, 110816 }, { 10.00, 113660 }, { 10.25, 116504 }, { 10.50, 119348 }, { 10.75, 122192 }, { 11.00, 125036 }, { 11.25, 127880 }, { 11.50, 130724 }, { 11.75, 133568 }, { 12.00, 136412 }, { 12.25, 139256 }, { 12.50, 142100 }, { 12.75, 144944 }, { 13.00, 147788 }, { 13.25, 150632 }, { 13.50, 153476 }, { 13.75, 156320 }, { 14.00, 159164 }, { 14.25, 162008 }, { 14.50, 164852 }, { 14.75, 167696 }, { 15.00, 170540 }, { 15.25, 173384 }, { 15.50, 176228 }, { 15.75, 179072 }, { 16.00, 181916 }, { 16.25, 184760 }, { 16.50, 187604 }
};
const int mapaC_pos_D_size = sizeof(mapaC_pos_D) / sizeof(mapaC_pos_D[0]);
const int mapaC_pos_I_size = sizeof(mapaC_pos_I) / sizeof(mapaC_pos_I[0]);

// Instancias de motores
AccelStepper controlCD(AccelStepper::DRIVER, STEP_C_R, DIR_PIN);  // Esferica Derecha
AccelStepper controlCI(AccelStepper::DRIVER, STEP_C_L, DIR_PIN);  // Esferica Izquierda
AccelStepper controlBD(AccelStepper::DRIVER, STEP_B_R, DIR_PIN);  // Cilíndrica Derecha
AccelStepper controlBI(AccelStepper::DRIVER, STEP_B_L, DIR_PIN);  // Cilíndrica Izquierda
AccelStepper controlAD(AccelStepper::DRIVER, STEP_A_R, DIR_PIN);  // Ángulo Derecho
AccelStepper controlAI(AccelStepper::DRIVER, STEP_A_L, DIR_PIN);  // Ángulo Izquierdo
AccelStepper controlDD(AccelStepper::DRIVER, STEP_D_R, DIR_PIN);  // Oclusión Derecha
AccelStepper controlDI(AccelStepper::DRIVER, STEP_D_L, DIR_PIN);  // Oclusión Izquierda

// Estado actual
float dioptriaActualCD = 0.00;  // Esferica Derecha
float dioptriaActualCI = 0.00;  // Esferica Izquierda
float cilindroActualCD = 0.00;  // Cilíndrica Derecha
float cilindroActualCI = 0.00;  // Cilíndrica Izquierda
int anguloActualCD = 0;  // Ángulo Derecho
int anguloActualCI = 0;  // Ángulo Izquierdo
char occlusionActualCD[6] = "close";  // Oclusión Derecha
char occlusionActualCI[6] = "close";  // Oclusión Izquierda

// ============================================================
// UTILIDADES DE MOVIMIENTO
// ============================================================

// Buscar en mapa de lentes esfericas
long buscarMicropasosC(const MapaC* mapa, int mapaSize, float dioptria, bool &ok) {
  for (int i = 0; i < mapaSize; i++) {
    if (fabs(mapa[i].dioptria - dioptria) < 0.001f) {
      ok = true;
      return mapa[i].pasos;
    }
  }
  ok = false;
  return 0;
}

// mover lentes esfericos
void moverLenteEsferico(char ojo, float diop) {
  bool ok = false;
  long pasosDestino = 0;
  if (ojo == 'R') {
    pasosDestino = buscarMicropasosC(mapaC_pos_D, mapaC_pos_D_size, diop, ok);
    if (ok) { dioptriaActualCD = diop; controlCD.moveTo(pasosDestino); }
  } else {
    pasosDestino = buscarMicropasosC(mapaC_pos_I, mapaC_pos_I_size, diop, ok);
    if (ok) { dioptriaActualCI = diop; controlCI.moveTo(pasosDestino); }
  }
  if (!ok) Serial.println("Error: Valor de dioptría fuera de rango.");
}

// mover lentes cilindricos
void moverLenteCilindrico(char ojo, float diop) {
  // Validar que sea múltiplo de 0.25D
  float resto = fmod(fabs(diop), 0.25);
  if (resto > 0.001 && resto < 0.249) {
    Serial.println("Error: Valor de cilindro debe ser múltiplo de 0.25D");
    return;
  }
  
  // Validar rango: debe estar entre -6.00 y 0.00 (nunca positivo)
  if (diop > 0.001) {
    Serial.printf("Error: Valor de cilindro %.2f debe ser negativo o cero (rango: 0.00 a -6.00)\n", diop);
    return;
  }
  if (diop < -6.001) {
    Serial.printf("Error: Valor de cilindro %.2f fuera de rango (máximo: -6.00)\n", diop);
    return;
  }
  
  // Calcular posición absoluta en pasos desde 0.00D (invertido para dirección correcta)
  long pasosAbsolutos = (long)(-((diop / 0.25) * pasosPor025D));
  
  if (ojo == 'R') {
    cilindroActualCD = diop;
    controlBD.moveTo(pasosAbsolutos);
  } else {
    cilindroActualCI = diop;
    controlBI.moveTo(pasosAbsolutos);
  }
}

// mover angulo de cilindros
void moverAnguloCilindro(char ojo, int angulo) {
  // Validar rango 0-359°
  if (angulo < 0 || angulo > 359) {
    Serial.println("Error: Ángulo debe estar entre 0 y 359 grados");
    return;
  }
  
  // Calcular posición absoluta en pasos desde 0°
  long pasosDestino = (long)(angulo * pasosPorGrado);
  
  if (ojo == 'R') {
    controlAD.moveTo(pasosDestino);
    anguloActualCD = angulo;
  } else {
    controlAI.moveTo(pasosDestino);
    anguloActualCI = angulo;
  }
}

// mover oclusión
void moverOclusion(char ojo, const char* estado) {
  long pasosDestino = 0;
  
  // Seleccionar posición absoluta según estado y ojo (usando micropasos predefinidos)
  if (strcmp(estado, "close") == 0) {
    pasosDestino = (ojo == 'R') ? oclusionClose_R : oclusionClose_L;
  } else if (strcmp(estado, "open") == 0) {
    pasosDestino = (ojo == 'R') ? oclusionOpen_R : oclusionOpen_L;
  } else {
    Serial.println("Error: Estado de oclusión debe ser 'open' o 'close'");
    return;
  }
  
  // Realizar movimiento absoluto
  if (ojo == 'R') {
    strcpy(occlusionActualCD, estado);
    controlDD.moveTo(pasosDestino);
  } else {
    strcpy(occlusionActualCI, estado);
    controlDI.moveTo(pasosDestino);
  }
}

// ============================================================
// FUNCIONES DE HOMING (AJUSTAR POSICIONES SIN MOVER MOTORES)
// ============================================================

// Ajustar posición de esfera sin mover físicamente el motor
void ajustarPosicionEsfera(char ojo, float dioptria) {
  bool ok = false;
  long pasosDestino = 0;
  
  if (ojo == 'R') {
    pasosDestino = buscarMicropasosC(mapaC_pos_D, mapaC_pos_D_size, dioptria, ok);
    if (ok) {
      // Establecer la posición actual del motor sin moverlo
      controlCD.setCurrentPosition(pasosDestino);
      dioptriaActualCD = dioptria;
      Serial.printf("Homing R-esfera: establecido en %.2fD (pasos: %ld)\n", dioptria, pasosDestino);
    } else {
      Serial.printf("Error: Valor de dioptría %.2f fuera de rango para homing R-esfera\n", dioptria);
    }
  } else {
    pasosDestino = buscarMicropasosC(mapaC_pos_I, mapaC_pos_I_size, dioptria, ok);
    if (ok) {
      controlCI.setCurrentPosition(pasosDestino);
      dioptriaActualCI = dioptria;
      Serial.printf("Homing L-esfera: establecido en %.2fD (pasos: %ld)\n", dioptria, pasosDestino);
    } else {
      Serial.printf("Error: Valor de dioptría %.2f fuera de rango para homing L-esfera\n", dioptria);
    }
  }
}

// Ajustar posición de cilindro sin mover físicamente el motor
void ajustarPosicionCilindro(char ojo, float cilindro) {
  // Validar que sea múltiplo de 0.25D
  float resto = fmod(fabs(cilindro), 0.25);
  if (resto > 0.001 && resto < 0.249) {
    Serial.printf("Error: Valor de cilindro %.2f debe ser múltiplo de 0.25D para homing\n", cilindro);
    return;
  }
  
  // Validar rango: debe estar entre -6.00 y 0.00 (nunca positivo)
  if (cilindro > 0.001) {
    Serial.printf("Error: Valor de cilindro %.2f debe ser negativo o cero (rango: 0.00 a -6.00) para homing\n", cilindro);
    return;
  }
  if (cilindro < -6.001) {
    Serial.printf("Error: Valor de cilindro %.2f fuera de rango (máximo: -6.00) para homing\n", cilindro);
    return;
  }
  
  // Calcular pasos desde 0.00D hasta el valor recibido (invertido para dirección correcta)
  long pasosDesdeCero = (long)(-((cilindro / 0.25) * pasosPor025D));
  
  if (ojo == 'R') {
    controlBD.setCurrentPosition(pasosDesdeCero);
    cilindroActualCD = cilindro;
    Serial.printf("Homing R-cilindro: establecido en %.2fD (pasos: %ld)\n", cilindro, pasosDesdeCero);
  } else {
    controlBI.setCurrentPosition(pasosDesdeCero);
    cilindroActualCI = cilindro;
    Serial.printf("Homing L-cilindro: establecido en %.2fD (pasos: %ld)\n", cilindro, pasosDesdeCero);
  }
}

// Ajustar posición de ángulo sin mover físicamente el motor
void ajustarPosicionAngulo(char ojo, int angulo) {
  // Validar rango 0-359°
  if (angulo < 0 || angulo > 359) {
    Serial.printf("Error: Ángulo %d debe estar entre 0 y 359 grados para homing\n", angulo);
    return;
  }
  
  // Calcular pasos desde 0° hasta el ángulo recibido
  long pasosDesdeCero = (long)(angulo * pasosPorGrado);
  
  if (ojo == 'R') {
    controlAD.setCurrentPosition(pasosDesdeCero);
    anguloActualCD = angulo;
    Serial.printf("Homing R-angulo: establecido en %d° (pasos: %ld)\n", angulo, pasosDesdeCero);
  } else {
    controlAI.setCurrentPosition(pasosDesdeCero);
    anguloActualCI = angulo;
    Serial.printf("Homing L-angulo: establecido en %d° (pasos: %ld)\n", angulo, pasosDesdeCero);
  }
}

// Ajustar posición de oclusión sin mover físicamente el motor
void ajustarPosicionOclusion(char ojo, const char* estado) {
  // Validar estado
  if (strcmp(estado, "open") != 0 && strcmp(estado, "close") != 0) {
    Serial.printf("Error: Estado de oclusión '%s' debe ser 'open' o 'close' para homing\n", estado);
    return;
  }
  
  // Seleccionar posición absoluta según estado y ojo (usando micropasos predefinidos)
  long pasosDestino = 0;
  if (strcmp(estado, "close") == 0) {
    pasosDestino = (ojo == 'R') ? oclusionClose_R : oclusionClose_L;
  } else {
    pasosDestino = (ojo == 'R') ? oclusionOpen_R : oclusionOpen_L;
  }
  
  if (ojo == 'R') {
    controlDD.setCurrentPosition(pasosDestino);
    strcpy(occlusionActualCD, estado);
    Serial.printf("Homing R-occlusion: establecido en %s (pasos: %ld)\n", estado, pasosDestino);
  } else {
    controlDI.setCurrentPosition(pasosDestino);
    strcpy(occlusionActualCI, estado);
    Serial.printf("Homing L-occlusion: establecido en %s (pasos: %ld)\n", estado, pasosDestino);
  }
}

// Movimiento secuencial (hasta 8 movimientos posibles)
void ejecutarMovimientoSecuencial(bool moverREsfera, bool moverRCilindro, bool moverRAngulo, bool moverROclusion,
                                   bool moverLEsfera, bool moverLCilindro, bool moverLAngulo, bool moverLOclusion) {
  ejecutandoMovimientoSecuencial = true;  // Activar bandera para evitar movimientos simultáneos en loop()
  
  // Ojo derecho - Esfera
  if (moverREsfera) {
    Serial.println("Moviendo R-esfera...");
    while (controlCD.distanceToGo() != 0) {
      controlCD.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("R-esfera completado.");
  }

  // Ojo derecho - Cilindro
  if (moverRCilindro) {
    Serial.println("Moviendo R-cilindro...");
    while (controlBD.distanceToGo() != 0) {
      controlBD.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("R-cilindro completado.");
  }

  // Ojo derecho - Ángulo
  if (moverRAngulo) {
    Serial.println("Moviendo R-angulo...");
    while (controlAD.distanceToGo() != 0) {
      controlAD.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("R-angulo completado.");
  }

  // Ojo derecho - Oclusión
  if (moverROclusion) {
    Serial.println("Moviendo R-occlusion...");
    while (controlDD.distanceToGo() != 0) {
      controlDD.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("R-occlusion completado.");
  }

  // Ojo izquierdo - Esfera
  if (moverLEsfera) {
    Serial.println("Moviendo L-esfera...");
    while (controlCI.distanceToGo() != 0) {
      controlCI.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("L-esfera completado.");
  }

  // Ojo izquierdo - Cilindro
  if (moverLCilindro) {
    Serial.println("Moviendo L-cilindro...");
    while (controlBI.distanceToGo() != 0) {
      controlBI.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("L-cilindro completado.");
  }

  // Ojo izquierdo - Ángulo
  if (moverLAngulo) {
    Serial.println("Moviendo L-angulo...");
    while (controlAI.distanceToGo() != 0) {
      controlAI.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("L-angulo completado.");
  }

  // Ojo izquierdo - Oclusión
  if (moverLOclusion) {
    Serial.println("Moviendo L-occlusion...");
    while (controlDI.distanceToGo() != 0) {
      controlDI.run();
      client.loop();  // Mantener MQTT activo durante movimientos largos
    }
    Serial.println("L-occlusion completado.");
  }
  
  ejecutandoMovimientoSecuencial = false;  // Desactivar bandera al finalizar
}

// ============================================================
// PROCESAR COMANDO HOMING
// ============================================================
void procesarComandoHome(StaticJsonDocument<300>& doc) {
  Serial.println("Procesando comando de homing...");
  
  // Procesar ojo derecho (R)
  if (doc.containsKey("R")) {
    JsonObject R = doc["R"];
    
    if (R.containsKey("esfera")) {
      float valor = R["esfera"];
      ajustarPosicionEsfera('R', valor);
    }
    
    if (R.containsKey("cilindro")) {
      float valor = R["cilindro"];
      ajustarPosicionCilindro('R', valor);
    }
    
    if (R.containsKey("angulo")) {
      int valor = R["angulo"];
      ajustarPosicionAngulo('R', valor);
    }
    
    if (R.containsKey("occlusion")) {
      const char* valor = R["occlusion"];
      ajustarPosicionOclusion('R', valor);
    }
  }
  
  // Procesar ojo izquierdo (L)
  if (doc.containsKey("L")) {
    JsonObject L = doc["L"];
    
    if (L.containsKey("esfera")) {
      float valor = L["esfera"];
      ajustarPosicionEsfera('L', valor);
    }
    
    if (L.containsKey("cilindro")) {
      float valor = L["cilindro"];
      ajustarPosicionCilindro('L', valor);
    }
    
    if (L.containsKey("angulo")) {
      int valor = L["angulo"];
      ajustarPosicionAngulo('L', valor);
    }
    
    if (L.containsKey("occlusion")) {
      const char* valor = L["occlusion"];
      ajustarPosicionOclusion('L', valor);
    }
  }
  
  Serial.println("Homing completado.");
}

// ============================================================
// PUBLICAR ESTADO (con verificación de conexión y reintentos)
// ============================================================
void publicarEstado(const char* status) {
  // --- Verificar conexión antes de publicar ---
  if (!client.connected()) {
    Serial.println("MQTT desconectado, intentando reconectar antes de publicar...");
    reconnect();
  }

  // --- Construir payload JSON ---
  StaticJsonDocument<200> doc;
  time_t now = time(nullptr);
  doc["status"] = status;
  doc["timestamp"] = now;

  // Solo agregar R y L si es ready o ping (para no sobrecargar busy)
  if (strcmp(status, "ready") == 0 || strcmp(status, "ping") == 0) {
    JsonObject R = doc.createNestedObject("R");
    R["esfera"] = dioptriaActualCD;
    R["cilindro"] = cilindroActualCD;
    R["angulo"] = anguloActualCD;
    R["occlusion"] = occlusionActualCD;
    JsonObject L = doc.createNestedObject("L");
    L["esfera"] = dioptriaActualCI;
    L["cilindro"] = cilindroActualCI;
    L["angulo"] = anguloActualCI;
    L["occlusion"] = occlusionActualCI;
  }

  char buffer[256];
  serializeJson(doc, buffer);

  // --- Intentar publicar con reintentos ---
  bool ok = false;
  int intentos = 0;
  const int MAX_INTENTOS = 3;

  while (!ok && intentos < MAX_INTENTOS) {
    ok = client.publish(topicPub, buffer);
    if (ok) {
      Serial.print("Estado publicado: ");
      Serial.println(buffer);
      break;
    } else {
      Serial.printf("Falló publicar (intento %d de %d). Reintentando...", intentos + 1, MAX_INTENTOS);
      reconnect();
      delay(500);
      intentos++;
    }
  }

  if (!ok) {
    Serial.println("Error: No se pudo publicar el mensaje MQTT tras varios intentos.");
  }

  // --- Actualizar marca temporal del último publish ---
  lastPublish = millis();
}


// ============================================================
// CALLBACK MQTT (RECIBIR COMANDOS)
// ============================================================
void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<300> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    Serial.println("Error al parsear JSON");
    return;
  }

  const char* token = doc["token"];
  if (strcmp(token, tokenEsperado) != 0) {
    Serial.println("Error: Token inválido");
    return;
  }

  const char* accion = doc["accion"];
  if (!accion) return;

  // Procesar comando de homing
  if (strcmp(accion, "home") == 0) {
    publicarEstado("busy");
    procesarComandoHome(doc);
    publicarEstado("ready");
    return;
  }

  // Procesar comando de movimiento
  if (strcmp(accion, "movimiento") != 0) return;

  publicarEstado("busy");

  bool moverREsfera = false, moverRCilindro = false, moverRAngulo = false, moverROclusion = false;
  bool moverLEsfera = false, moverLCilindro = false, moverLAngulo = false, moverLOclusion = false;

  // Procesar ojo derecho (R)
  if (doc.containsKey("R")) {
    JsonObject R = doc["R"];
    if (R.containsKey("esfera")) {
      float valor = R["esfera"];
      if (fabs(valor - dioptriaActualCD) > 0.001f) {
        Serial.printf("Configurando R-esfera: %.2f (actual: %.2f)\n", valor, dioptriaActualCD);
        moverLenteEsferico('R', valor);
        moverREsfera = true;
      } else {
        Serial.printf("R-esfera ya está en %.2f, omitiendo movimiento\n", valor);
      }
    }
    if (R.containsKey("cilindro")) {
      float valor = R["cilindro"];
      if (fabs(valor - cilindroActualCD) > 0.001f) {
        Serial.printf("Configurando R-cilindro: %.2f (actual: %.2f)\n", valor, cilindroActualCD);
        moverLenteCilindrico('R', valor);
        moverRCilindro = true;
      } else {
        Serial.printf("R-cilindro ya está en %.2f, omitiendo movimiento\n", valor);
      }
    }
    if (R.containsKey("angulo")) {
      int valor = R["angulo"];
      if (valor != anguloActualCD) {
        Serial.printf("Configurando R-angulo: %d (actual: %d)\n", valor, anguloActualCD);
        moverAnguloCilindro('R', valor);
        moverRAngulo = true;
      } else {
        Serial.printf("R-angulo ya está en %d, omitiendo movimiento\n", valor);
      }
    }
    if (R.containsKey("occlusion")) {
      const char* valor = R["occlusion"];
      if (strcmp(valor, occlusionActualCD) != 0) {
        Serial.printf("Configurando R-occlusion: %s (actual: %s)\n", valor, occlusionActualCD);
        moverOclusion('R', valor);
        moverROclusion = true;
      } else {
        Serial.printf("R-occlusion ya está en %s, omitiendo movimiento\n", valor);
      }
    }
  }

  // Procesar ojo izquierdo (L)
  if (doc.containsKey("L")) {
    JsonObject L = doc["L"];
    if (L.containsKey("esfera")) {
      float valor = L["esfera"];
      if (fabs(valor - dioptriaActualCI) > 0.001f) {
        Serial.printf("Configurando L-esfera: %.2f (actual: %.2f)\n", valor, dioptriaActualCI);
        moverLenteEsferico('L', valor);
        moverLEsfera = true;
      } else {
        Serial.printf("L-esfera ya está en %.2f, omitiendo movimiento\n", valor);
      }
    }
    if (L.containsKey("cilindro")) {
      float valor = L["cilindro"];
      if (fabs(valor - cilindroActualCI) > 0.001f) {
        Serial.printf("Configurando L-cilindro: %.2f (actual: %.2f)\n", valor, cilindroActualCI);
        moverLenteCilindrico('L', valor);
        moverLCilindro = true;
      } else {
        Serial.printf("L-cilindro ya está en %.2f, omitiendo movimiento\n", valor);
      }
    }
    if (L.containsKey("angulo")) {
      int valor = L["angulo"];
      if (valor != anguloActualCI) {
        Serial.printf("Configurando L-angulo: %d (actual: %d)\n", valor, anguloActualCI);
        moverAnguloCilindro('L', valor);
        moverLAngulo = true;
      } else {
        Serial.printf("L-angulo ya está en %d, omitiendo movimiento\n", valor);
      }
    }
    if (L.containsKey("occlusion")) {
      const char* valor = L["occlusion"];
      if (strcmp(valor, occlusionActualCI) != 0) {
        Serial.printf("Configurando L-occlusion: %s (actual: %s)\n", valor, occlusionActualCI);
        moverOclusion('L', valor);
        moverLOclusion = true;
      } else {
        Serial.printf("L-occlusion ya está en %s, omitiendo movimiento\n", valor);
      }
    }
  }

  // Ejecución secuencial: R-esfera -> R-cilindro -> R-angulo -> R-occlusion -> L-esfera -> L-cilindro -> L-angulo -> L-occlusion
  ejecutarMovimientoSecuencial(moverREsfera, moverRCilindro, moverRAngulo, moverROclusion,
                                moverLEsfera, moverLCilindro, moverLAngulo, moverLOclusion);

  publicarEstado("ready");
}

// ============================================================
// CONEXIÓN MQTT
// ============================================================
void reconnect() {
  while (!client.connected()) {
    Serial.print("Intentando conectar MQTT...");
    if (client.connect("foroptero01-esp32")) {
      Serial.println("Conectado al broker");
      client.subscribe(topicSub);
      Serial.print("Suscripto a: ");
      Serial.println(topicSub);
    } else {
      Serial.printf("Error: Fallo de red, reintentando en 5s", client.state());
      delay(5000);
    }
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(3000);
  WiFi.begin(ssid, password);
  Serial.print("Conectando WiFi...");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("WiFi conectado");

  // Hora UTC (GMT 0)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  auto cfgEsfera = [](AccelStepper& m) {
    m.setMaxSpeed(ESFERA_MAX_SPEED);
    m.setAcceleration(ESFERA_ACCELERATION);
  };
  auto cfgOtros = [](AccelStepper& m) {
    m.setMaxSpeed(OTROS_MAX_SPEED);
    m.setAcceleration(OTROS_ACCELERATION);
  };

  cfgEsfera(controlCD);
  cfgEsfera(controlCI);
  cfgOtros(controlBD);
  cfgOtros(controlBI);
  cfgOtros(controlAD);
  cfgOtros(controlAI);
  cfgOtros(controlDD);
  cfgOtros(controlDI);

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Solo ejecutar run() si NO estamos en modo secuencial
  // Durante ejecución secuencial, los motores se controlan dentro de ejecutarMovimientoSecuencial()
  if (!ejecutandoMovimientoSecuencial) {
    // Ejecutar run() para mantener suavidad si se mueve algo pendiente (movimientos independientes)
    controlCD.run();
    controlCI.run();
    controlBD.run();
    controlBI.run();
    controlAD.run();
    controlAI.run();
    controlDD.run();
    controlDI.run();
  }

// --- Ping automático cada 30s si no hubo otros mensajes ---
  if (millis() - lastPublish > PING_INTERVAL) {
    publicarEstado("ready");
  }

}
