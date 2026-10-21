import { lyricsSettings } from './lyricsCore';
import { lyricsStorageLoad, lyricsStorageSave } from './lyricsStorage';
import { lyricsLoopsRenderPreviewFrameWhenIdle } from './lyricsLoops';

const templatesKey = (templateType) => templateType === 'header' ? lyricsSettings.lyricsStorageKeys.headerTemplates : lyricsSettings.lyricsStorageKeys.footerTemplates;
const templatesRead = (templateType) => JSON.parse(lyricsStorageLoad(templatesKey(templateType), '[]'));
const templatesWrite = (templateType, templates) => lyricsStorageSave(templatesKey(templateType), JSON.stringify(templates));

const templatesRenderList = (dialog, templateType) => {
    const list = dialog.querySelector('.element_template_list');
    list.replaceChildren();
    const templates = templatesRead(templateType);

    if (!templates.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'border-border text-meta rounded-2xl border border-dashed p-8 text-center text-sm';
        emptyState.textContent = 'No templates yet. Create your first template below.';
        list.append(emptyState);
        return;
    }

    templates.forEach((template, templateIndex) => {
        const templateRow = document.createElement('div');
        templateRow.className = 'border-border bg-background/60 flex items-center justify-between gap-4 rounded-2xl border p-4';

        const templateDetails = document.createElement('div');
        templateDetails.className = 'min-w-0';
        const templateName = document.createElement('p');
        templateName.className = 'truncate text-sm font-bold';
        templateName.textContent = template.name;
        const templateContent = document.createElement('p');
        templateContent.className = 'text-meta mt-1 truncate text-xs';
        templateContent.textContent = template.content;
        templateDetails.append(templateName, templateContent);

        const templateActions = document.createElement('div');
        templateActions.className = 'flex shrink-0 gap-2';
        const createTemplateAction = (label, className) => {
            const actionButton = document.createElement('button');
            actionButton.type = 'button';
            actionButton.className = `cursor-pointer rounded-lg border px-4 py-2 text-xs font-bold shadow-lg transition-all active:scale-95 ${className}`;
            actionButton.textContent = label;
            return actionButton;
        };

        const useButton = createTemplateAction('Use', 'bg-teal text-background hover:brightness-110');
        useButton.addEventListener('click', () => {
            const textareaSelector = templateType === 'header' ? lyricsSettings.elementSelectorTextareaHeader : lyricsSettings.elementSelectorTextareaFooter;
            const storageKey = templateType === 'header' ? lyricsSettings.lyricsStorageKeys.lyricsHeader : lyricsSettings.lyricsStorageKeys.lyricsFooter;
            document.querySelector(textareaSelector).value = template.content;
            lyricsStorageSave(storageKey, template.content);
            lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.elementSelectorAudio));
            dialog.close();
        });

        const editButton = createTemplateAction('Edit', 'border-border border text-text');
        editButton.addEventListener('click', () => {
            const form = dialog.querySelector('.element_template_form');
            form.elements.name.value = template.name;
            form.elements.content.value = template.content;
            form.dataset.editingTemplateIndex = templateIndex;
            form.elements.name.focus();
        });

        const deleteButton = createTemplateAction('Delete', 'text-red hover:bg-red/10');
        deleteButton.addEventListener('click', () => {
            if (!confirm(`Hapus template "${template.name}"?`)) return;
            templates.splice(templateIndex, 1);
            templatesWrite(templateType, templates);
            templatesRenderList(dialog, templateType);
        });

        templateActions.append(useButton, editButton, deleteButton);
        templateRow.append(templateDetails, templateActions);
        list.append(templateRow);
    });
};

export const lyricsTemplatesBind = () => document.querySelectorAll('.element_dialog_template').forEach((dialog) => {
    const type = dialog.dataset.templateType;
    document.querySelector(type === 'header' ? '.element_button_select_header' : '.element_button_select_footer').addEventListener('click', () => {
        templatesRenderList(dialog, type); dialog.showModal();
    });

    dialog.querySelector('.element_button_close_template').addEventListener('click', () => dialog.close());
    dialog.querySelector('.element_template_form').addEventListener('submit', (submitEvent) => {
        submitEvent.preventDefault();
        const templateForm = submitEvent.currentTarget;
        const templates = templatesRead(type);
        const editingTemplateIndex = templateForm.dataset.editingTemplateIndex;
        const templateData = { name: templateForm.elements.name.value.trim(), content: templateForm.elements.content.value };

        if (editingTemplateIndex === undefined) {
            templates.push(templateData);
        } else {
            templates[Number(editingTemplateIndex)] = templateData;
            delete templateForm.dataset.editingTemplateIndex;
        }

        templatesWrite(type, templates);
        templateForm.reset();
        templatesRenderList(dialog, type);
    });
});
