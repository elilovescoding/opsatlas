package dev.opsatlas;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

class HealthPolicyTest {
  @Test
  void distinguishesSlowFailureAndHealthy() {
    assertThat(HealthMonitor.classify(200, 20)).isEqualTo(Domain.HealthState.HEALTHY);
    assertThat(HealthMonitor.classify(204, 501)).isEqualTo(Domain.HealthState.DEGRADED);
    assertThat(HealthMonitor.classify(503, 10)).isEqualTo(Domain.HealthState.UNAVAILABLE);
    assertThat(HealthMonitor.classify(null, 4000)).isEqualTo(Domain.HealthState.UNAVAILABLE);
    assertThat(HealthMonitor.classify(302, 10)).isEqualTo(Domain.HealthState.UNAVAILABLE);
  }

  @Test
  void blocksMetadataDnsAndArbitraryTargets() {
    for (String host :
        new String[] {
          "169.254.169.254", "localhost", "10.0.0.1", "example.com", "127.0.0.1@evil.com", "::1"
        })
      assertThatThrownBy(() -> HealthMonitor.target(Domain.HealthTarget.DEMO_API, host))
          .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> HealthMonitor.target(Domain.HealthTarget.NONE, "127.0.0.1"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(HealthMonitor.target(Domain.HealthTarget.DEMO_API, "127.0.0.1").toString())
        .isEqualTo("http://127.0.0.1:9090/healthy");
  }
}
