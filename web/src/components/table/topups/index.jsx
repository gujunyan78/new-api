/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import CardPro from '../../common/ui/CardPro';
import TopupsTable from './TopupsTable';
import TopupsActions from './TopupsActions';
import TopupsDescription from './TopupsDescription';
import TopupsFilters from './TopupsFilters';
import AdminManualTopUpModal from '../../topup/AdminManualTopUpModal';
import { useTopupsData } from '../../../hooks/topups/useTopupsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const TopupsPage = () => {
  const topupsData = useTopupsData();
  const isMobile = useIsMobile();

  const {
    showTopupModal,
    setShowTopupModal,
    handleTopUpSuccess,
    compactMode,
    setCompactMode,
    loadTopups,
    searchTopups,
    activePage,
    pageSize,
    formInitValues,
    setFormApi,
    loading,
    searching,
    t,
  } = topupsData;

  return (
    <>
      <AdminManualTopUpModal
        visible={showTopupModal}
        onCancel={() => setShowTopupModal(false)}
        onSuccess={handleTopUpSuccess}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <TopupsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <TopupsActions setShowTopupModal={setShowTopupModal} t={t} />
            <TopupsFilters
              formInitValues={formInitValues}
              setFormApi={setFormApi}
              searchTopups={searchTopups}
              loadTopups={loadTopups}
              activePage={activePage}
              pageSize={pageSize}
              loading={loading}
              searching={searching}
              t={t}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: topupsData.activePage,
          pageSize: topupsData.pageSize,
          total: topupsData.topupCount,
          onPageChange: topupsData.handlePageChange,
          onPageSizeChange: topupsData.handlePageSizeChange,
          isMobile: isMobile,
          t: topupsData.t,
        })}
        t={topupsData.t}
      >
        <TopupsTable {...topupsData} />
      </CardPro>
    </>
  );
};

export default TopupsPage;
