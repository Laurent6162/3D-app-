// app.js - main controller. Wires the UI to the 3D viewer and loads the
// product data via AJAX. I am using jQuery because it was what the labs
// used and it makes the event/AJAX code short.

import { Viewer } from './scene.js';
import { renderThumbnail } from './models.js';

// ---- app state (kept simple - just a couple of globals) ----
let products = [];
let activeId = null;
let edition  = 'standard';
let viewer   = null;


$(function () {
    // page navigation (content swap)
    $('[data-page]').on('click', function (e) {
        e.preventDefault();
        showPage($(this).data('page'));
    });

    // 3D viewer
    const container = document.getElementById('viewer');
    if (container) viewer = new Viewer(container);

    // load product JSON
    $.getJSON('assets/data/products.json', function (data) {
        products = data.products;
        renderGallery();
        if (products.length) {
            activeId = products[0].id;
            applyActiveProduct();
        }
    });

    setupControls();
    setupKeyboard();
    setupFeedback();
});


function showPage(page) {
    $('.page').removeClass('active');
    $('#page-' + page).addClass('active');
    $('html, body').scrollTop(0);

    // three.js canvas needs a resize after being un-hidden
    if (page === 'app' && viewer) {
        setTimeout(function () { viewer._onResize(); }, 50);
    }
    if (page === 'about') loadFeedback();
}


function renderGallery() {
    const $gal = $('#product-gallery').empty();
    products.forEach(function (p) {
        const $btn = $(
            '<div class="product-thumb" data-id="' + p.id + '" role="button" tabindex="0" aria-label="Show ' + p.fullName + '">' +
            '  <div class="thumb-canvas-holder"></div>' +
            '  <div class="thumb-name">' + p.name + '</div>' +
            '</div>'
        );
        $btn.find('.thumb-canvas-holder').append(renderThumbnail(p, 60));

        $btn.on('click', function () {
            activeId = p.id;
            applyActiveProduct();
        });
        $btn.on('keypress', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                activeId = p.id;
                applyActiveProduct();
            }
        });
        $gal.append($btn);
    });
}


function getActive() {
    for (let i = 0; i < products.length; i++) {
        if (products[i].id === activeId) return products[i];
    }
    return null;
}


function applyActiveProduct() {
    const p = getActive();
    if (!p || !viewer) return;

    viewer.loadProduct(p);
    viewer.setEdition(edition);

    // gallery highlight
    $('.product-thumb').removeClass('active');
    $('.product-thumb[data-id="' + p.id + '"]').addClass('active');

    // info panel
    $('#info-name').text(p.fullName);
    $('#info-tagline').text(p.tagline);
    $('#info-flavour').text(p.flavour);
    $('#info-volume').text(p.volume);
    $('#info-year').text(p.year);
    $('#info-story').text(p.story);

    // media image - product-specific promo image
    $('#media-image').css('background-image', "url('assets/images/product-" + p.id + ".jpg')");
}


function setupControls() {
    // label editions
    $('.edition-btn').on('click', function () {
        $('.edition-btn').removeClass('active');
        $(this).addClass('active');
        edition = $(this).data('edition');
        if (viewer) viewer.setEdition(edition);
    });

    // rendering toggles
    $('#btn-wireframe').on('click', function () {
        $(this).toggleClass('active');
        viewer.setWireframe($(this).hasClass('active'));
    });
    $('#btn-shader').addClass('active').on('click', function () {
        $(this).toggleClass('active');
        viewer.setShaderEnabled($(this).hasClass('active'));
    });
    $('#btn-bloom').on('click', function () {
        $(this).toggleClass('active');
        viewer.setBloom($(this).hasClass('active'));
    });

    // lights
    $('#light-key').on('change',  function () { viewer.setLight('key',  this.checked); });
    $('#light-fill').on('change', function () { viewer.setLight('fill', this.checked); });
    $('#light-rim').on('change',  function () { viewer.setLight('rim',  this.checked); });
    $('#light-spot').on('change', function () { viewer.setLight('spot', this.checked); });

    // camera presets
    $('.cam-btn').on('click', function () {
        $('.cam-btn').removeClass('active');
        $(this).addClass('active');
        viewer.setCamera($(this).data('cam'));
    });
    $('.cam-btn[data-cam="default"]').addClass('active');

    // animation
    $('#btn-autorotate').on('click', function () {
        $(this).toggleClass('active');
        viewer.setAutoRotate($(this).hasClass('active'));
    });
    $('#btn-spin').on('click', function () { viewer.spinOnce(); });
}


function setupKeyboard() {
    $(document).on('keydown', function (e) {
        // only when the 3D app page is showing + user is not in a text field
        if (!$('#page-app').hasClass('active')) return;
        if ($(e.target).is('input, textarea')) return;

        const key = e.key.toLowerCase();
        if (key === '1' && products[0]) { activeId = products[0].id; applyActiveProduct(); }
        if (key === '2' && products[1]) { activeId = products[1].id; applyActiveProduct(); }
        if (key === '3' && products[2]) { activeId = products[2].id; applyActiveProduct(); }
        if (key === 'w') $('#btn-wireframe').click();
        if (key === 'r') $('#btn-autorotate').click();
        if (key === 's') $('#btn-spin').click();
    });
}


// ---- feedback form (talks to api/feedback.php) ----
function setupFeedback() {
    $('#feedback-form').on('submit', function (e) {
        e.preventDefault();
        const payload = {
            name: $(this).find('[name=name]').val(),
            message: $(this).find('[name=message]').val()
        };

        $.ajax({
            url: 'api/feedback.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload)
        }).done(function () {
            $('#feedback-form')[0].reset();
            loadFeedback();
        }).fail(function () {
            // fallback: if PHP isn't running, just keep it in localStorage so
            // the form still visibly works during testing with Live Server
            const list = JSON.parse(localStorage.getItem('novaFeedback') || '[]');
            list.unshift({
                name: payload.name,
                message: payload.message,
                created_at: new Date().toISOString(),
                local: true
            });
            localStorage.setItem('novaFeedback', JSON.stringify(list.slice(0, 20)));
            $('#feedback-form')[0].reset();
            renderFeedback(list);
        });
    });
}

function loadFeedback() {
    $.getJSON('api/feedback.php')
        .done(renderFeedback)
        .fail(function () {
            const list = JSON.parse(localStorage.getItem('novaFeedback') || '[]');
            renderFeedback(list);
        });
}

function renderFeedback(rows) {
    const $list = $('#feedback-list').empty();
    if (!rows || rows.length === 0) {
        $list.append('<p class="text-white-50 small">No comments yet. Be the first.</p>');
        return;
    }
    rows.forEach(function (r) {
        // escape whatever the user typed
        const safeName = $('<div>').text(r.name || 'Anonymous').html();
        const safeMsg  = $('<div>').text(r.message || '').html();
        const when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        $list.append(
            '<div class="feedback-item">' +
            '  <span class="fb-name">' + safeName + '</span>' +
            '  <span class="fb-time">· ' + when + (r.local ? ' · local' : '') + '</span>' +
            '  <div>' + safeMsg + '</div>' +
            '</div>'
        );
    });
}
