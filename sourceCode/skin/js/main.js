/* ============================
   ClearBench – main.js
   ============================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ============================
     1. SIDEBAR NAV – Active State & Collapsible Groups
     ============================ */
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Collapsible nav groups
  document.querySelectorAll('.nav-group-label').forEach(label => {
    label.addEventListener('click', () => {
      const group = label.closest('.nav-group');
      group.classList.toggle('collapsed');
    });
  });

  /* ============================
     2. TABS
     ============================ */
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.classList.add('active');
    });
  });

  /* ============================
     3. KPI COUNTER ANIMATION
     ============================ */
  function animateCount(el, target, duration = 1200, isFloat = false) {
    const start = performance.now();
    const startVal = 0;

    requestAnimationFrame(function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (target - startVal) * eased;

      if (isFloat) {
        el.textContent = current.toFixed(1) + '%';
      } else {
        el.textContent = Math.round(current).toLocaleString();
      }

      if (progress < 1) requestAnimationFrame(step);
    });
  }

  // Intersection Observer – trigger counters when visible
  const kpiValues = document.querySelectorAll('.kpi-value[data-count]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el      = entry.target;
        const raw     = el.dataset.count;
        const isFloat = el.dataset.float === 'true';
        const target  = parseFloat(raw);
        animateCount(el, target, 1200, isFloat);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  kpiValues.forEach(v => observer.observe(v));

  /* ============================
     4. FILTER SELECTS – Update + Refresh KPIs (demo)
     ============================ */
  document.querySelectorAll('.filter-select').forEach(sel => {
    sel.addEventListener('change', () => {
      // Visual feedback: pulse the KPI cards
      document.querySelectorAll('.kpi-card').forEach(card => {
        card.style.transition = 'opacity .2s';
        card.style.opacity    = '0.4';
        setTimeout(() => {
          card.style.opacity = '1';
        }, 220);
      });
    });
  });

  /* ============================
     5. MOBILE SIDEBAR TOGGLE
     ============================ */
  const sidebar      = document.querySelector('.sidebar');
  const menuToggle   = document.getElementById('menu-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

  /* ============================
     6. FAB – Chat / Help
     ============================ */
  const fab = document.getElementById('fab-btn');
  if (fab) {
    fab.addEventListener('click', () => {
      alert('Chat / Help feature coming soon!');
    });
  }

  /* ============================
     7. LOGOUT BUTTON
     ============================ */
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        // In a real app: redirect to login / call auth endpoint
        alert('Logged out successfully.');
      }
    });
  }

  /* ============================
     8. QUEUE TABLE – Row Highlighting
     ============================ */
  document.querySelectorAll('.queues-table tbody tr').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.queues-table tbody tr').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });
  });

  /* ============================
     9. TOOLTIP (lightweight)
     ============================ */
  const tooltip = document.createElement('div');
  tooltip.id = 'cb-tooltip';
  Object.assign(tooltip.style, {
    position: 'fixed',
    background: '#1a1d23',
    color: '#fff',
    fontSize: '11px',
    padding: '5px 10px',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity .15s',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(tooltip);

  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
      tooltip.textContent = el.dataset.tip;
      tooltip.style.opacity = '1';
    });
    el.addEventListener('mousemove', e => {
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top  = (e.clientY - 28) + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });

// ==========================
// Claims Trend Line Chart
// ==========================

  const claimsTrendCtx = document
  .getElementById("claimsTrend")
  .getContext("2d");
  
  new Chart(claimsTrendCtx, {
  type: "line",
  data: {
    labels: ["May 1", "May 7", "May 14", "May 21", "May 28", "May 31"],
    datasets: [
      {
        label: "Received",
        data: [950, 1150, 1080, 1700, 1100, 1220],
        borderColor: "#5B3DF5",
        backgroundColor: "#5B3DF5",
        pointBackgroundColor: "#5B3DF5",
        pointBorderColor: "#5B3DF5",
        pointRadius: 4,
        borderWidth: 3,
        tension: 0.4,
        fill: false,
      },
      {
        label: "Processed",
        data: [450, 650, 700, 1100, 730, 680],
        borderColor: "#16C172",
        backgroundColor: "#16C172",
        pointBackgroundColor: "#16C172",
        pointBorderColor: "#16C172",
        pointRadius: 4,
        borderWidth: 3,
        tension: 0.4,
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding:30,
          color: "#172554",
          font: {
            size: 12,
            weight: "600",
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        max: 2000,
        ticks: {
          stepSize: 500,
          callback: function (value) {
            return value >= 1000 ? value / 1000 + "K" : value;
          },
        },
        grid: {
          color: "#EEF2F7",
        },
        border: {
          display: false,
        },
      },
    },
  },
});

// ==========================
// Claims Status Doughnut
// ==========================

const claimStatusCtx = document
  .getElementById("claimStatusChart")
  .getContext("2d");

new Chart(claimStatusCtx, {
  type: "doughnut",
  data: {
    labels: ["Processed", "Pending", "Denied"],
    datasets: [
      {
        data: [2102, 446, 246],
        borderWidth: 0.5,
      },
    ],
  },
  options: {
    responsive: true,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: "#172554",
          font: {
            size: 12,
            weight: "700",
          },
        },
      },
      tooltip: {
        enabled: true,
      },
    },
  },
});

// ==========================
// Center Text Plugin
// ==========================

Chart.register({
  id: "centerText",
  beforeDraw(chart) {
    if (chart.config.type !== "doughnut") return;

    const {
      ctx,
      chartArea: { width, height },
    } = chart;

    ctx.save();

    ctx.font = "700 34px Inter";
    ctx.fillStyle = "#172554";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText("2,548", width / 2, height / 2 - 10);

    ctx.font = "500 14px Inter";
    ctx.fillStyle = "#64748B";

    ctx.fillText("Total", width / 2, height / 2 + 22);

    ctx.restore();
  },
});
// ==========================
// Animate KPI Numbers
// ==========================

function animateValue(element, start, end, duration) {
  let startTime = null;

  function animation(currentTime) {
    if (!startTime) startTime = currentTime;

    const progress = Math.min(
      (currentTime - startTime) / duration,
      1
    );

    element.textContent = Math.floor(
      progress * (end - start) + start
    ).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(animation);
    }
  }

  requestAnimationFrame(animation);
}

document.querySelectorAll("[data-counter]").forEach((counter) => {
  animateValue(
    counter,
    0,
    parseInt(counter.dataset.counter),
    1200
  );
});

});
