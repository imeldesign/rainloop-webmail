
import _ from '_';
import ko from 'ko';

import {StorageResultType, Notification} from 'Common/Enums';
import {getNotification} from 'Common/Translator';

import {
	windowResizeCallback, createCommand, isArray, trim, delegateRunOnDestroy
} from 'Common/Utils';

import {showScreenPopup} from 'Knoin/Knoin';

import FilterStore from 'Stores/User/Filter';
import Remote from 'Remote/User/Ajax';

import {FilterModel} from 'Model/Filter';

class FiltersUserSettings
{
	constructor() {
		this.modules = FilterStore.modules;
		this.filters = FilterStore.filters;

		this.inited = ko.observable(false);
		this.serverError = ko.observable(false);
		this.serverErrorDesc = ko.observable('');
		this.haveChanges = ko.observable(false);

		this.saveErrorText = ko.observable('');

		this.filters.subscribe(windowResizeCallback);

		this.serverError.subscribe((value) => {
			if (!value)
			{
				this.serverErrorDesc('');
			}
		}, this);

		this.filterRaw = FilterStore.raw;
		this.filterRaw.capa = FilterStore.capa;
		this.filterRaw.active = ko.observable(false);
		this.filterRaw.allow = ko.observable(false);
		this.filterRaw.error = ko.observable(false);

		this.filterForDeletion = ko.observable(null)
			.extend({falseTimeout: 3000}).extend({toggleSubscribeProperty: [this, 'deleteAccess']});

		this.saveChanges = createCommand(this, () => {
			if (!this.filters.saving())
			{
				if (this.filterRaw.active() && '' === trim(this.filterRaw()))
				{
					this.filterRaw.error(true);
					return false;
				}

				this.filters.saving(true);
				this.saveErrorText('');

				Remote.filtersSave((result, data) => {
					this.filters.saving(false);

					if (StorageResultType.Success === result && data && data.Result)
					{
						this.haveChanges(false);
						this.updateList();
					}
					else if (data && data.ErrorCode)
					{
						this.saveErrorText(data.ErrorMessageAdditional || getNotification(data.ErrorCode));
					}
					else
					{
						this.saveErrorText(getNotification(Notification.CantSaveFilters));
					}

				}, this.filters(), this.filterRaw(), this.filterRaw.active());
			}

			return true;
		}, () => this.haveChanges());

		this.filters.subscribe(() => {
			this.haveChanges(true);
		});

		this.filterRaw.subscribe(() => {
			this.haveChanges(true);
			this.filterRaw.error(false);
		});

		this.haveChanges.subscribe(() => {
			this.saveErrorText('');
		});

		this.filterRaw.active.subscribe(() => {
			this.haveChanges(true);
			this.filterRaw.error(false);
		});
	}

	scrollableOptions(wrapper) {
		return {
			handle: '.drag-handle',
			containment: wrapper || 'parent',
			axis: 'y'
		};
	}

	updateList() {
		if (!this.filters.loading())
		{
			this.filters.loading(true);

			Remote.filtersGet((result, data) => {

				this.filters.loading(false);
				this.serverError(false);

				if (StorageResultType.Success === result && data && data.Result && isArray(data.Result.Filters))
				{
					this.inited(true);
					this.serverError(false);

					this.filters(_.compact(_.map(data.Result.Filters, (aItem) => {
						const filter = new FilterModel();
						return (filter && filter.parse(aItem)) ? filter : null;
					})));

					this.modules(data.Result.Modules ? data.Result.Modules : {});

					this.filterRaw(data.Result.Raw || '');
					this.filterRaw.capa(isArray(data.Result.Capa) ? data.Result.Capa.join(' ') : '');
					this.filterRaw.active(!!data.Result.RawIsActive);
					this.filterRaw.allow(!!data.Result.RawIsAllow);
				}
				else
				{
					this.filters([]);
					this.modules({});
					this.filterRaw('');
					this.filterRaw.capa({});

					this.serverError(true);
					this.serverErrorDesc(data && data.ErrorCode ? getNotification(data.ErrorCode) : getNotification(Notification.CantGetFilters));
				}

				this.haveChanges(false);
			});
		}
	}

	deleteFilter(filter) {
		this.filters.remove(filter);
		delegateRunOnDestroy(filter);
	}

	addFilter() {
		const filter = new FilterModel();

		filter.generateID();
		showScreenPopup(require('View/Popup/Filter'), [filter, () => {
			this.filters.push(filter);
			this.filterRaw.active(false);
		}, false]);
	}

	editFilter(filter) {
		const clonedFilter = filter.cloneSelf();

		showScreenPopup(require('View/Popup/Filter'), [clonedFilter, () => {
			const
				filters = this.filters(),
				index = filters.indexOf(filter);

			if (-1 < index && filters[index])
			{
				delegateRunOnDestroy(filters[index]);
				filters[index] = clonedFilter;

				this.filters(filters);
				this.haveChanges(true);
			}
		}, true]);
	}

	onBuild(oDom) {
		const self = this;

		oDom
			.on('click', '.filter-item .e-action', function() {
				const filter = ko.dataFor(this);
				if (filter)
				{
					self.editFilter(filter);
				}
			});
	}

	onShow() {
		this.updateList();
	}
}

export {FiltersUserSettings, FiltersUserSettings as default};
